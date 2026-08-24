from apps.notifications.ws_urls import websocket_urlpatterns as notification_websocket_urlpatterns
from apps.tickets.ws_urls import websocket_urlpatterns as ticket_websocket_urlpatterns
from apps.workspaces.ws_urls import websocket_urlpatterns as workspace_websocket_urlpatterns

websocket_urlpatterns = [
	*ticket_websocket_urlpatterns,
	*notification_websocket_urlpatterns,
	*workspace_websocket_urlpatterns,
]
