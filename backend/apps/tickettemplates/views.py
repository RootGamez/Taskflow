from __future__ import annotations

from django.db import IntegrityError
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project
from apps.tickettemplates.models import TicketTemplate
from apps.tickettemplates.serializers import (
    TicketTemplateCreateSerializer,
    TicketTemplateSerializer,
    TicketTemplateUpdateSerializer,
)
from apps.workspaces.access import WorkspaceRoleAccessMixin

# D25: limite de plantillas por proyecto. Protege la misma ruta caliente que
# `MAX_SUBTASKS_PER_TICKET` (apps/subtasks/views.py): `apply_template_items`
# (apps.tickettemplates.services) crea hasta `MAX_TEMPLATE_ITEMS` (50,
# apps/tickettemplates/serializers.py) `SubTask` por ticket creado con
# plantilla.
MAX_TEMPLATES_PER_PROJECT = 20


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _get_template_or_404(project: Project, template_id: str) -> TicketTemplate:
    # RT-10: `prefetch_related("items")` aca (no solo en el listado) para
    # que la respuesta de POST/PATCH tampoco dispare N+1 al serializar
    # `items`.
    template = project.ticket_templates.filter(id=template_id).prefetch_related("items").first()
    if template is None:
        raise NotFound("Plantilla no encontrada.")
    return template


class TicketTemplateListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        # RT-8: un viewer SI puede listar plantillas -- solo crear, editar o
        # borrar exige rol de escritura (necesita verlas para el dia que se
        # le de permiso de crear tickets con ellas).
        templates = project.ticket_templates.prefetch_related("items")
        return Response(TicketTemplateSerializer(templates, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, project_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)

        # D25/RT-5: se corta antes de gastar una query de validacion/insert
        # de mas si el proyecto ya esta en el limite (mismo patron que
        # `SubTaskListCreateView.post`).
        if project.ticket_templates.count() >= MAX_TEMPLATES_PER_PROJECT:
            raise ValidationError({"detail": "Un proyecto no puede tener mas de 20 plantillas."})

        serializer = TicketTemplateCreateSerializer(data=request.data, context={"project": project, "request": request})
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear la plantilla.")

        # RT-6: segunda linea de defensa contra la carrera de dos POST
        # concurrentes con el mismo nombre -- patron literal de
        # labels/views.py:52-55. El `validate()` del serializer ya hizo un
        # SELECT antes de este INSERT; el constraint
        # `unique_ticket_template_name_per_project` (Lower("name")) es la
        # fuente de verdad real.
        try:
            template = serializer.save()
        except IntegrityError:
            raise ValidationError({"detail": "Ya existe una plantilla con ese nombre en este proyecto."})

        template = _get_template_or_404(project, template.id)
        return Response(TicketTemplateSerializer(template).data, status=status.HTTP_201_CREATED)


class TicketTemplateDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, project_id: str, template_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        template = _get_template_or_404(project, template_id)

        serializer = TicketTemplateUpdateSerializer(template, data=request.data, context={"project": project}, partial=True)
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar la plantilla.")

        try:
            template = serializer.save()
        except IntegrityError:
            raise ValidationError({"detail": "Ya existe una plantilla con ese nombre en este proyecto."})

        template = _get_template_or_404(project, template.id)
        return Response(TicketTemplateSerializer(template).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, project_id: str, template_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        template = _get_template_or_404(project, template_id)

        # D22: NO existe `Ticket.template` -- borrar la plantilla nunca
        # toca tickets ya creados con ella (RT-2). `items` se borra en
        # cascada (`TicketTemplateItem.template` es `on_delete=CASCADE`).
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
