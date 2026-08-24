from django.urls import path

from apps.tickets.views import TicketDetailView, TicketImageUploadView, TicketVideoUploadView, TicketListCreateView, TicketSingleView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/tickets/",
        TicketListCreateView.as_view(),
        name="ticket-list-create",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/",
        TicketDetailView.as_view(),
        name="ticket-detail",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/images/",
        TicketImageUploadView.as_view(),
        name="ticket-image-upload",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/videos/",
        TicketVideoUploadView.as_view(),
        name="ticket-video-upload",
    ),
    path(
        "tickets/<uuid:ticket_id>/",
        TicketSingleView.as_view(),
        name="ticket-single",
    ),
]
