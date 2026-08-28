from django.urls import path

from apps.relations.views import TicketRelationDetailView, TicketRelationListCreateView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/relations/",
        TicketRelationListCreateView.as_view(),
        name="ticket-relation-list-create",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/relations/<uuid:relation_id>/",
        TicketRelationDetailView.as_view(),
        name="ticket-relation-detail",
    ),
]
