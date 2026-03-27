from __future__ import annotations

from datetime import timedelta
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.tickets.models import Ticket, TicketFieldLock
from apps.tickets.serializers import TicketSerializer, TicketUpdateSerializer
from apps.workspaces.models import WorkspaceMember


class BaseJWTConsumer(AsyncJsonWebsocketConsumer):
    async def _get_user_from_token(self):
        query_string = self.scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]

        if not token:
            return None

        try:
            access_token = AccessToken(token)
            user_id = access_token.get("user_id")
            if user_id is None:
                return None
        except TokenError:
            return None

        return await self._get_user(user_id)

    @database_sync_to_async
    def _get_user(self, user_id):
        user_model = get_user_model()
        return user_model.objects.filter(id=user_id).first()


class ProjectConsumer(BaseJWTConsumer):
    async def connect(self):
        self.project_id = self.scope["url_route"]["kwargs"]["project_id"]
        self.group_name = f"project_{self.project_id}"

        user = await self._get_user_from_token()
        if user is None:
            await self.close(code=4401)
            return

        membership = await self._get_project_membership(self.project_id, user.id)
        if membership is None:
            await self.close(code=4403)
            return

        self.user = user
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def ticket_created(self, event):
        await self.send_json({
            "type": "ticket.created",
            "ticket": event.get("ticket"),
            "source": event.get("source"),
        })

    async def ticket_updated(self, event):
        await self.send_json({
            "type": "ticket.updated",
            "ticket": event.get("ticket"),
            "source": event.get("source"),
        })

    async def ticket_deleted(self, event):
        await self.send_json(
            {
                "type": "ticket.deleted",
                "ticket_id": event.get("ticket_id"),
                "project_id": event.get("project_id"),
                "column_id": event.get("column_id"),
                "source": event.get("source"),
            }
        )

    @database_sync_to_async
    def _get_project_membership(self, project_id: str, user_id):
        return (
            WorkspaceMember.objects.filter(
                workspace__projects__id=project_id,
                user_id=user_id,
            )
            .only("role")
            .first()
        )


class TicketConsumer(BaseJWTConsumer):
    EDITABLE_FIELDS = {
        "title",
        "priority",
        "due_date",
        "column_id",
        "description",
        "progress_notes",
    }
    LOCK_TTL_SECONDS = 15

    async def connect(self):
        self.ticket_id = self.scope["url_route"]["kwargs"]["ticket_id"]
        self.group_name = f"ticket_{self.ticket_id}"

        user = await self._get_user_from_token()
        if user is None:
            await self.close(code=4401)
            return

        membership = await self._get_ticket_membership(self.ticket_id, user.id)
        if membership is None:
            await self.close(code=4403)
            return

        self.user = user
        self.user_id = str(user.id)
        self.user_name = getattr(user, "full_name", "") or getattr(user, "email", "Usuario")
        self.membership_role = membership.role

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        locks = await self._list_active_locks()
        if locks:
            await self.send_json({"type": "field.snapshot", "locks": locks})

    async def disconnect(self, close_code):
        released_fields = await self._release_all_locks_for_user()
        for field in released_fields:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "field.released",
                    "field": field,
                    "user_id": self.user_id,
                },
            )

        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        action = content.get("action")

        if action == "lock_field":
            await self._handle_lock_field(content)
            return

        if action == "unlock_field":
            await self._handle_unlock_field(content)
            return

        if action == "typing":
            await self._handle_typing(content)
            return

        if action != "patch":
            await self.send_json({"type": "error", "detail": "Accion no soportada."})
            return

        if self.membership_role not in {
            WorkspaceMember.Role.OWNER,
            WorkspaceMember.Role.ADMIN,
            WorkspaceMember.Role.MEMBER,
        }:
            await self.send_json({"type": "error", "detail": "No tienes permisos para editar tickets."})
            return

        payload = content.get("payload")
        if not isinstance(payload, dict):
            await self.send_json({"type": "error", "detail": "Payload invalido."})
            return

        for protected_field in self.EDITABLE_FIELDS.intersection(payload.keys()):
            lock = await self._get_active_lock(protected_field)
            if lock and lock["user_id"] != self.user_id:
                await self.send_json(
                    {
                        "type": "error",
                        "detail": f"{lock['user_name']} esta editando, por favor espera.",
                    }
                )
                return

        result = await self._patch_ticket(ticket_id=self.ticket_id, payload=payload)

        if result.get("error"):
            await self.send_json({"type": "error", "detail": result["error"]})
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "ticket.updated",
                "ticket": result["ticket"],
                "source": str(self.user.id),
            },
        )
        await self.channel_layer.group_send(
            f"project_{result['project_id']}",
            {
                "type": "ticket.updated",
                "ticket": result["ticket"],
                "source": str(self.user.id),
            },
        )

    async def ticket_updated(self, event):
        await self.send_json(
            {
                "type": "ticket.updated",
                "ticket": event["ticket"],
                "source": event.get("source"),
            }
        )

    async def field_locked(self, event):
        await self.send_json(
            {
                "type": "field.locked",
                "field": event["field"],
                "user_id": event["user_id"],
                "user_name": event["user_name"],
            }
        )

    async def field_released(self, event):
        await self.send_json(
            {
                "type": "field.released",
                "field": event["field"],
                "user_id": event["user_id"],
            }
        )

    async def field_typing(self, event):
        await self.send_json(
            {
                "type": "field.typing",
                "field": event["field"],
                "value": event["value"],
                "user_id": event["user_id"],
                "user_name": event["user_name"],
            }
        )

    async def _handle_lock_field(self, content: dict):
        field = content.get("field")
        if field not in self.EDITABLE_FIELDS:
            await self.send_json({"type": "error", "detail": "Campo invalido."})
            return

        lock_result = await self._acquire_lock(field)
        if not lock_result["acquired"]:
            await self.send_json(
                {
                    "type": "field.lock_denied",
                    "field": field,
                    "user_id": lock_result["user_id"],
                    "user_name": lock_result["user_name"],
                }
            )
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "field.locked",
                "field": field,
                "user_id": self.user_id,
                "user_name": self.user_name,
            },
        )

    async def _handle_unlock_field(self, content: dict):
        field = content.get("field")
        if field not in self.EDITABLE_FIELDS:
            return

        released = await self._release_lock(field)
        if not released:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "field.released",
                "field": field,
                "user_id": self.user_id,
            },
        )

    async def _handle_typing(self, content: dict):
        field = content.get("field")
        value = content.get("value")
        if field not in self.EDITABLE_FIELDS or not isinstance(value, str):
            return

        lock_result = await self._acquire_lock(field)
        if not lock_result["acquired"]:
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "field.typing",
                "field": field,
                "value": value,
                "user_id": self.user_id,
                "user_name": self.user_name,
            },
        )

    @database_sync_to_async
    def _get_ticket_membership(self, ticket_id: str, user_id):
        return (
            WorkspaceMember.objects.filter(
                workspace__projects__tickets__id=ticket_id,
                user_id=user_id,
            )
            .only("role")
            .first()
        )

    @database_sync_to_async
    def _patch_ticket(self, ticket_id: str, payload: dict):
        ticket = (
            Ticket.objects.select_related("project", "column", "created_by")
            .filter(id=ticket_id)
            .first()
        )
        if ticket is None:
            return {"error": "Ticket no encontrado."}

        serializer = TicketUpdateSerializer(
            ticket,
            data=payload,
            partial=True,
            context={"project": ticket.project},
        )
        if not serializer.is_valid():
            errors = serializer.errors
            first_error = next(iter(errors.values()), None)
            if isinstance(first_error, list) and first_error:
                message = str(first_error[0])
            else:
                message = "No se pudo actualizar el ticket."
            return {"error": message}

        updated_ticket = serializer.save()
        serialized_ticket = TicketSerializer(updated_ticket).data
        return {"ticket": serialized_ticket, "project_id": str(serialized_ticket["project_id"])}

    @database_sync_to_async
    def _get_active_lock(self, field: str):
        now = timezone.now()
        lock = (
            TicketFieldLock.objects.select_related("user")
            .filter(ticket_id=self.ticket_id, field=field)
            .first()
        )
        if not lock:
            return None

        if lock.expires_at <= now:
            lock.delete()
            return None

        return {
            "user_id": str(lock.user_id),
            "user_name": lock.user_name,
            "expires_at": lock.expires_at,
        }

    @database_sync_to_async
    def _list_active_locks(self):
        now = timezone.now()
        TicketFieldLock.objects.filter(ticket_id=self.ticket_id, expires_at__lte=now).delete()

        locks = TicketFieldLock.objects.filter(ticket_id=self.ticket_id)
        payload = []
        for lock in locks:
            payload.append(
                {
                    "field": lock.field,
                    "user_id": str(lock.user_id),
                    "user_name": lock.user_name,
                }
            )
        return payload

    @database_sync_to_async
    def _acquire_lock(self, field: str):
        now = timezone.now()
        expires_at = now + timedelta(seconds=self.LOCK_TTL_SECONDS)

        with transaction.atomic():
            TicketFieldLock.objects.filter(ticket_id=self.ticket_id, field=field, expires_at__lte=now).delete()
            lock = TicketFieldLock.objects.select_for_update().filter(ticket_id=self.ticket_id, field=field).first()

            if lock and str(lock.user_id) != self.user_id:
                return {
                    "acquired": False,
                    "user_id": str(lock.user_id),
                    "user_name": lock.user_name,
                }

            if lock:
                lock.user_name = self.user_name
                lock.expires_at = expires_at
                lock.save(update_fields=["user_name", "expires_at", "updated_at"])
                return {"acquired": True}

            TicketFieldLock.objects.create(
                ticket_id=self.ticket_id,
                field=field,
                user_id=self.user_id,
                user_name=self.user_name,
                expires_at=expires_at,
            )

        return {"acquired": True}

    @database_sync_to_async
    def _release_lock(self, field: str):
        deleted, _ = TicketFieldLock.objects.filter(
            ticket_id=self.ticket_id,
            field=field,
            user_id=self.user_id,
        ).delete()
        return deleted > 0

    @database_sync_to_async
    def _release_all_locks_for_user(self):
        rows = list(
            TicketFieldLock.objects.filter(ticket_id=self.ticket_id, user_id=self.user_id).values_list("field", flat=True)
        )
        TicketFieldLock.objects.filter(ticket_id=self.ticket_id, user_id=self.user_id).delete()
        return rows
