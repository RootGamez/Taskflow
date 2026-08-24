from django.urls import re_path

from apps.tickets.consumers import ProjectConsumer, TicketConsumer

websocket_urlpatterns = [
    re_path(r"ws/projects/(?P<project_id>[0-9a-f-]+)/$", ProjectConsumer.as_asgi()),
    re_path(r"ws/tickets/(?P<ticket_id>[0-9a-f-]+)/$", TicketConsumer.as_asgi()),
]
