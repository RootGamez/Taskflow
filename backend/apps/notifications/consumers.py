from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = await self._get_user_from_token()
        if user is None:
            await self.close(code=4401)
            return

        self.user = user
        self.group_name = f"notifications_{self.user.id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def notification_created(self, event):
        await self.send_json(
            {
                "type": "notification.created",
                "notification": event.get("notification"),
            }
        )

    async def notification_updated(self, event):
        await self.send_json(
            {
                "type": "notification.updated",
                "notification": event.get("notification"),
            }
        )

    async def notification_read(self, event):
        await self.send_json(
            {
                "type": "notification.read",
                "notification_id": event.get("notification_id"),
                "read_at": event.get("read_at"),
            }
        )

    async def notification_bulk_read(self, event):
        await self.send_json(
            {
                "type": "notification.bulk_read",
                "ids": event.get("ids", []),
                "read_at": event.get("read_at"),
            }
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
