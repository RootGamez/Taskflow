from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project
from apps.subtasks.models import SubTask
from apps.subtasks.serializers import SubTaskCreateSerializer, SubTaskSerializer, SubTaskUpdateSerializer
from apps.tickets.models import Ticket
from apps.workspaces.access import WorkspaceRoleAccessMixin

# D34: limite duro de subtareas por ticket, precedente
# `MAX_ACTIVITIES_RETURNED` (apps/activities/views.py) y `MY_TASKS_LIMIT`
# (apps/tickets/my_tasks.py). Protege la ruta caliente de
# `prefetch_related("subtasks")` sobre cada listado de tickets del proyecto
# (D12 de docs/PHASE_3_PLAN.md): sin este limite, un script podria crear
# decenas de miles de filas que se cargarian en memoria en cada listado.
MAX_SUBTASKS_PER_TICKET = 100


def _get_ticket_or_404(project: Project, ticket_id: str) -> Ticket:
    ticket = project.tickets.filter(id=ticket_id).first()
    if ticket is None:
        raise NotFound("Ticket no encontrado.")
    return ticket


def _get_subtask_or_404(ticket: Ticket, subtask_id: str) -> SubTask:
    # RB3: doble scoping -- la subtarea tiene que pertenecer al ticket que ya
    # fue scopeado al proyecto del usuario. Un subtask_id valido de OTRO
    # ticket (incluso de otro proyecto) devuelve 404 aca, nunca 200.
    subtask = ticket.subtasks.filter(id=subtask_id).select_related("assignee").first()
    if subtask is None:
        raise NotFound("Subtarea no encontrada.")
    return subtask


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


class SubTaskListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        ticket = _get_ticket_or_404(project, ticket_id)

        subtasks = ticket.subtasks.select_related("assignee")
        return Response(SubTaskSerializer(subtasks, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = _get_ticket_or_404(project, ticket_id)

        # D34/RB7: se corta antes de gastar una query de validacion/insert de
        # mas si el ticket ya esta en el limite.
        if ticket.subtasks.count() >= MAX_SUBTASKS_PER_TICKET:
            raise ValidationError({"detail": "Un ticket no puede tener mas de 100 subtareas."})

        serializer = SubTaskCreateSerializer(
            data=request.data, context={"project": project, "ticket": ticket, "request": request}
        )
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear la subtarea.")

        subtask = serializer.save()
        subtask = ticket.subtasks.select_related("assignee").get(id=subtask.id)
        return Response(SubTaskSerializer(subtask).data, status=status.HTTP_201_CREATED)


class SubTaskDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, project_id: str, ticket_id: str, subtask_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = _get_ticket_or_404(project, ticket_id)
        subtask = _get_subtask_or_404(ticket, subtask_id)

        serializer = SubTaskUpdateSerializer(
            subtask, data=request.data, context={"project": project}, partial=True
        )
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar la subtarea.")

        subtask = serializer.save()
        subtask = ticket.subtasks.select_related("assignee").get(id=subtask.id)
        return Response(SubTaskSerializer(subtask).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, project_id: str, ticket_id: str, subtask_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = _get_ticket_or_404(project, ticket_id)
        subtask = _get_subtask_or_404(ticket, subtask_id)

        subtask.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
