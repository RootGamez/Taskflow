from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def send_activity_event(ticket_id: str, activity: dict) -> None:
    """Emite `activity.created` al grupo `ticket_{ticket_id}` (mismo grupo
    que usan `ticket.updated` y `comment.*`). `TicketConsumer.activity_created`
    ya sabe manejar este `type` desde la Fase 0.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        f"ticket_{ticket_id}",
        {"type": "activity.created", "activity": activity},
    )
