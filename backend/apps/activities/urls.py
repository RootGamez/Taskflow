from django.urls import path

from apps.activities.views import TicketActivityListView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/activities/",
        TicketActivityListView.as_view(),
        name="ticket-activity-list",
    ),
]
