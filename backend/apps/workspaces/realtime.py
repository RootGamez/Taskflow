from __future__ import annotations

import json

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.serializers.json import DjangoJSONEncoder


def send_workspace_event(workspace_id: str, event_name: str, payload: dict):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    # channels_redis serializes with msgpack, so UUID/datetime must be normalized first.
    normalized_payload = json.loads(json.dumps(payload, cls=DjangoJSONEncoder))

    async_to_sync(channel_layer.group_send)(
        f"workspace_{workspace_id}",
        {
            "type": "workspace.event",
            "event": event_name,
            "payload": normalized_payload,
        },
    )
