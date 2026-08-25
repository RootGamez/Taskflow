from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_comment_event(ticket_id: str, payload: dict) -> None:
    """Espejo de `apps.notifications.realtime.send_notification_event`.

    Envía al mismo grupo `ticket_{ticket_id}` que ya usa `TicketConsumer`
    para los locks de campo, reusando sus handlers `comment_created`/
    `comment_updated`/`comment_deleted`.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"ticket_{ticket_id}",
        payload,
    )
