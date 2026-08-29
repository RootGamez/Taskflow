from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.sprints.models import Sprint
from apps.sprints.serializers import SprintCreateSerializer, SprintSerializer, SprintUpdateSerializer
from apps.sprints.services import activate_sprint, annotate_sprint_progress, complete_sprint
from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.workspaces.models import Workspace


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _get_sprint_or_404(workspace: Workspace, sprint_id: str) -> Sprint:
    sprint = workspace.sprints.filter(id=sprint_id).first()
    if sprint is None:
        raise NotFound("Sprint no encontrado.")
    return sprint


def _serialize_sprint(workspace: Workspace, sprint: Sprint) -> dict:
    annotated = annotate_sprint_progress(workspace.sprints.filter(id=sprint.id)).get()
    return SprintSerializer(annotated).data


class SprintListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, workspace_slug: str) -> Response:
        workspace = self.get_workspace_for_user(request, workspace_slug)
        sprints = annotate_sprint_progress(workspace.sprints.all())
        return Response(SprintSerializer(sprints, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, workspace_slug: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)

        serializer = SprintCreateSerializer(data=request.data, context={"workspace": workspace})
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear el sprint.")

        sprint = serializer.save()
        return Response(_serialize_sprint(workspace, sprint), status=status.HTTP_201_CREATED)


class SprintDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, workspace_slug: str, sprint_id: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        sprint = _get_sprint_or_404(workspace, sprint_id)

        serializer = SprintUpdateSerializer(sprint, data=request.data, partial=True)
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar el sprint.")

        sprint = serializer.save()
        return Response(_serialize_sprint(workspace, sprint), status=status.HTTP_200_OK)

    def delete(self, request: Request, workspace_slug: str, sprint_id: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        sprint = _get_sprint_or_404(workspace, sprint_id)

        # Borrar un sprint activo dejaria N tickets sin sprint de golpe.
        # Forzar a finalizarlo primero deja un registro explicito.
        if sprint.status == Sprint.Status.ACTIVE:
            raise ValidationError({"detail": "Finaliza el sprint antes de eliminarlo."})

        sprint.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SprintActivateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, workspace_slug: str, sprint_id: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        sprint = _get_sprint_or_404(workspace, sprint_id)

        sprint = activate_sprint(sprint)
        return Response(_serialize_sprint(workspace, sprint), status=status.HTTP_200_OK)


class SprintCompleteView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, workspace_slug: str, sprint_id: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        sprint = _get_sprint_or_404(workspace, sprint_id)

        sprint = complete_sprint(sprint)
        return Response(_serialize_sprint(workspace, sprint), status=status.HTTP_200_OK)
