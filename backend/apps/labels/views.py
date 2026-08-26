from __future__ import annotations

from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.labels.models import Label
from apps.labels.serializers import LabelCreateSerializer, LabelSerializer, LabelUpdateSerializer
from apps.projects.models import Project
from apps.workspaces.access import WorkspaceRoleAccessMixin


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _get_label_or_404(project: Project, label_id: str) -> Label:
    label = project.labels.filter(id=label_id).first()
    if label is None:
        raise NotFound("Label no encontrado.")
    return label


class LabelListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        labels = project.labels.all()
        return Response(LabelSerializer(labels, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, project_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)

        serializer = LabelCreateSerializer(data=request.data, context={"project": project})
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear el label.")

        # Segunda linea de defensa contra la carrera de dos POST concurrentes
        # con el mismo nombre (D39): el `validate()` del serializer ya hizo un
        # `SELECT` antes de este `INSERT`, asi que sigue existiendo una
        # ventana de carrera entre ese SELECT y este INSERT. El constraint
        # `unique_label_name_per_project` (Lower("name")) es la fuente de
        # verdad real; sin este try/except la carrera devolveria un 500.
        try:
            label = serializer.save()
        except IntegrityError:
            raise ValidationError({"detail": "Ya existe un label con ese nombre en este proyecto."})

        return Response(LabelSerializer(label).data, status=status.HTTP_201_CREATED)


class LabelDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, project_id: str, label_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        label = _get_label_or_404(project, label_id)

        serializer = LabelUpdateSerializer(
            label, data=request.data, context={"project": project}, partial=True
        )
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar el label.")

        try:
            label = serializer.save()
        except IntegrityError:
            raise ValidationError({"detail": "Ya existe un label con ese nombre en este proyecto."})

        return Response(LabelSerializer(label).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, project_id: str, label_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        label = _get_label_or_404(project, label_id)

        # La M2M `Ticket.labels` tiene FK `CASCADE` sobre la tabla
        # intermedia (`tickets_ticket_labels`): borrar el label borra esas
        # filas de la intermedia, nunca los tickets (RC1).
        label.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
