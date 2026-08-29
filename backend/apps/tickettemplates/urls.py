from __future__ import annotations

from django.urls import path

from apps.tickettemplates.views import TicketTemplateDetailView, TicketTemplateListCreateView

urlpatterns = [
    path(
        "projects/<uuid:project_id>/ticket-templates/",
        TicketTemplateListCreateView.as_view(),
        name="ticket-template-list-create",
    ),
    path(
        "projects/<uuid:project_id>/ticket-templates/<uuid:template_id>/",
        TicketTemplateDetailView.as_view(),
        name="ticket-template-detail",
    ),
]
