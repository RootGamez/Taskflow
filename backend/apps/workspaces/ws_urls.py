from django.urls import re_path

from apps.workspaces.consumers import WorkspaceEventsConsumer

websocket_urlpatterns = [
    re_path(r"ws/workspaces/(?P<workspace_slug>[-a-zA-Z0-9_]+)/events/$", WorkspaceEventsConsumer.as_asgi()),
]
