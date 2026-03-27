from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_notification_event(user_id: str, payload: dict):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"notifications_{user_id}",
        payload,
    )
