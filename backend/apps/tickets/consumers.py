from __future__ import annotations
import time
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer, TicketUpdateSerializer
from apps.workspaces.models import WorkspaceMember


class TicketConsumer(AsyncJsonWebsocketConsumer):
    EDITABLE_FIELDS = {
        "title",
        "priority",
        "due_date",
        "column_id",
        "description",
        "progress_notes",
    }
    LOCK_TTL_SECONDS = 15
    FIELD_LOCKS: dict[str, dict[str, str | float]] = {}

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

    async def disconnect(self, close_code):
        await self._release_all_locks_for_user()
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

        for protected_field in self.EDITABLE_FIELDS:
            if protected_field in payload:
                lock = self._get_lock(protected_field)
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

        lock = self._get_lock(field)
        if lock and lock["user_id"] != self.user_id:
            await self.send_json(
                {
                    "type": "field.lock_denied",
                    "field": field,
                    "user_id": lock["user_id"],
                    "user_name": lock["user_name"],
                }
            )
            return

        self._set_lock(field)
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

        lock = self._get_lock(field)
        if not lock or lock["user_id"] != self.user_id:
            return

        self._delete_lock(field)
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

        lock = self._get_lock(field)
        if lock and lock["user_id"] != self.user_id:
            return

        self._set_lock(field)
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

    def _lock_key(self, field: str) -> str:
        return f"{self.ticket_id}:{field}"

    def _get_lock(self, field: str):
        key = self._lock_key(field)
        lock = self.FIELD_LOCKS.get(key)
        if not lock:
            return None

        expires_at = float(lock.get("expires_at", 0))
        if expires_at <= time.time():
            self.FIELD_LOCKS.pop(key, None)
            return None
        return lock

    def _set_lock(self, field: str):
        self.FIELD_LOCKS[self._lock_key(field)] = {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "expires_at": time.time() + self.LOCK_TTL_SECONDS,
        }

    def _delete_lock(self, field: str):
        self.FIELD_LOCKS.pop(self._lock_key(field), None)

    async def _release_all_locks_for_user(self):
        released_fields: list[str] = []
        for field in self.EDITABLE_FIELDS:
            lock = self._get_lock(field)
            if lock and lock["user_id"] == self.user_id:
                self._delete_lock(field)
                released_fields.append(field)

        for field in released_fields:
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "field.released",
                    "field": field,
                    "user_id": self.user_id,
                },
            )

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
        return {"ticket": TicketSerializer(updated_ticket).data}
