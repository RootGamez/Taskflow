from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project
from apps.sprints.models import Sprint
from apps.sprints.serializers import SprintCreateSerializer, SprintSerializer, SprintUpdateSerializer
from apps.sprints.services import (
    activate_sprint,
    annotate_sprint_progress,
    complete_sprint,
    get_done_column_id,
)
from apps.workspaces.access import WorkspaceRoleAccessMixin


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    """Replica local de `apps.comments.views._raise_first_validation_error`
    (D2): no vale la pena un modulo compartido nuevo que acople a los 3
    agentes que trabajan en paralelo sobre apps distintas.
    """
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _get_sprint_or_404(project: Project, sprint_id: str) -> Sprint:
    sprint = project.sprints.filter(id=sprint_id).first()
    if sprint is None:
        raise NotFound("Sprint no encontrado.")
    return sprint


def _serialize_sprint(project: Project, sprint: Sprint) -> dict:
    done_column_id = get_done_column_id(project)
    annotated = annotate_sprint_progress(project.sprints.filter(id=sprint.id), done_column_id).get()
    return SprintSerializer(annotated).data


class SprintListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        done_column_id = get_done_column_id(project)
        sprints = annotate_sprint_progress(project.sprints.all(), done_column_id)
        return Response(SprintSerializer(sprints, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, project_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)

        serializer = SprintCreateSerializer(data=request.data, context={"project": project})
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear el sprint.")

        sprint = serializer.save()
        return Response(_serialize_sprint(project, sprint), status=status.HTTP_201_CREATED)


class SprintDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, project_id: str, sprint_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        sprint = _get_sprint_or_404(project, sprint_id)

        serializer = SprintUpdateSerializer(sprint, data=request.data, partial=True)
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar el sprint.")

        sprint = serializer.save()
        return Response(_serialize_sprint(project, sprint), status=status.HTTP_200_OK)

    def delete(self, request: Request, project_id: str, sprint_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        sprint = _get_sprint_or_404(project, sprint_id)

        # D15: borrar un sprint activo mandaria N tickets al backlog sin
        # dejar rastro (el `SET_NULL` es silencioso a nivel DB, D16). Forzar
        # a finalizarlo primero deja un registro explicito de la decision.
        if sprint.status == Sprint.Status.ACTIVE:
            raise ValidationError({"detail": "Finaliza el sprint antes de eliminarlo."})

        sprint.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SprintActivateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, project_id: str, sprint_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        sprint = _get_sprint_or_404(project, sprint_id)

        sprint = activate_sprint(sprint)
        return Response(_serialize_sprint(project, sprint), status=status.HTTP_200_OK)


class SprintCompleteView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, project_id: str, sprint_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        sprint = _get_sprint_or_404(project, sprint_id)

        sprint = complete_sprint(sprint)
        return Response(_serialize_sprint(project, sprint), status=status.HTTP_200_OK)
