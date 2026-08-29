from django.urls import path

from apps.tickets.my_tasks import MyTasksView
from apps.tickets.search import SearchTicketsView
from apps.tickets.views import (
    TicketDetailView,
    TicketImageUploadView,
    TicketVideoUploadView,
    TicketListCreateView,
    TicketSingleView,
    WorkspaceSprintBoardView,
)

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
    # Declarada ANTES de "tickets/<uuid:ticket_id>/" a proposito, aunque no
    # es estrictamente necesario: el converter `uuid` no matchea el string
    # literal "mine", asi que Django nunca la confundiria con un ticket_id
    # (ver test_my_tasks.py). El orden explicito es documentacion.
    path(
        "tickets/mine/",
        MyTasksView.as_view(),
        name="ticket-my-tasks",
    ),
    # Declarada ANTES de "tickets/<uuid:ticket_id>/" por el mismo motivo que
    # "tickets/mine/": aunque el converter `uuid` ya la distingue por si
    # solo, el orden explicito documenta que "search" nunca puede
    # confundirse con un `ticket_id`. Ruta separada de
    # "projects/<uuid:project_id>/tickets/" a proposito -- la busqueda es
    # cross-workspace (D20 de docs/PHASE_3_PLAN.md), como "tickets/mine/".
    path(
        "search/tickets/",
        SearchTicketsView.as_view(),
        name="ticket-search",
    ),
    path(
        "workspaces/<slug:workspace_slug>/board/",
        WorkspaceSprintBoardView.as_view(),
        name="workspace-sprint-board",
    ),
    path(
        "tickets/<uuid:ticket_id>/",
        TicketSingleView.as_view(),
        name="ticket-single",
    ),
]
