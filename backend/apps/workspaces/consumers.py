from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.workspaces.models import WorkspaceMember


class WorkspaceEventsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.workspace_slug = self.scope["url_route"]["kwargs"]["workspace_slug"]

        user = await self._get_user_from_token()
        if user is None:
            await self.close(code=4401)
            return

        membership = await self._get_membership(self.workspace_slug, user.id)
        if membership is None:
            await self.close(code=4403)
            return

        self.group_name = f"workspace_{membership.workspace_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def workspace_event(self, event):
        await self.send_json(
            {
                "type": "workspace.event",
                "event": event.get("event"),
                "payload": event.get("payload", {}),
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

    @database_sync_to_async
    def _get_membership(self, workspace_slug: str, user_id):
        return (
            WorkspaceMember.objects.select_related("workspace")
            .filter(workspace__slug=workspace_slug, user_id=user_id)
            .first()
        )
