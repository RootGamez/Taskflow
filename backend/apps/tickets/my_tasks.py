"""`GET /api/v1/tickets/mine/` -- vista personal "Mis tareas" (Fase 2).

Cross-workspace a proposito: a diferencia del resto de `apps.tickets`, este
endpoint no recibe `project_id`. El scope de visibilidad replica
exactamente `WorkspaceRoleAccessMixin.get_project_for_user` (D28, ver
docs/PHASE_2_REMAINING_PLAN.md seccion 5.3): todos los proyectos de todos
los workspaces donde el usuario tenga una `WorkspaceMember`, sin filtrar
por `is_active` -- el mixin tampoco lo hace, y divergir en un solo endpoint
seria una inconsistencia silenciosa de reglas de acceso.
"""

from __future__ import annotations

from django.db.models import F
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer
from apps.workspaces.models import WorkspaceMember

# Limite duro de filas devueltas (mismo precedente que
# MAX_ACTIVITIES_RETURNED en apps/activities/views.py:16). El slice se
# aplica DESPUES de order_by para que el corte sea determinista y deje lo
# mas urgente: con el orden "vencidos primero, luego fecha ascendente,
# sin fecha al final", los primeros 500 son siempre los mas prioritarios.
MY_TASKS_LIMIT = 500


class MyTaskSerializer(TicketSerializer):
    """`TicketSerializer` + el proyecto embebido (D27).

    Sin el nombre/color/slug del proyecto no se puede agrupar la vista de
    "Mis tareas" (DESIGN_SYSTEM.md 8.3), y hacer el join en el frontend es
    imposible porque esta vista es cross-workspace mientras que
    `useProjects` es por `workspaceSlug`. `apps/tickets/serializers.py` es
    archivo prohibido para este agente -- por eso este serializer subclasea
    en vez de modificarlo (import de solo lectura).
    """

    project = serializers.SerializerMethodField()

    class Meta(TicketSerializer.Meta):
        fields = (*TicketSerializer.Meta.fields, "project")

    def get_project(self, obj: Ticket) -> dict:
        # Asume `select_related("project", "project__workspace")` desde el
        # call site (ver `MyTasksView.get`) -- no dispara queries nuevas.
        project = obj.project
        return {
            "id": str(project.id),
            "name": project.name,
            "key": project.key,
            "color": project.color,
            "workspace_slug": project.workspace.slug,
        }


class MyTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        # Subquery de workspace ids en vez de un JOIN sobre memberships
        # (D29): `filter(project__workspace__memberships__user=...)`
        # obligaria a `.distinct()`, y `.distinct()` combinado con
        # `order_by` sobre campos relacionados puede romper la
        # deduplicacion en silencio. La subquery elimina esa clase de bug
        # entera sin necesitar `.distinct()`.
        member_workspace_ids = WorkspaceMember.objects.filter(user=request.user).values_list(
            "workspace_id", flat=True
        )

        tickets = (
            Ticket.objects.filter(assignees=request.user, project__workspace_id__in=member_workspace_ids)
            .exclude(project__is_archived=True)
            .select_related("project", "project__workspace", "column", "created_by", "sprint")
            .prefetch_related("assignees", "labels", "subtasks")
            .order_by("project__name", F("due_date").asc(nulls_last=True), "created_at")[:MY_TASKS_LIMIT]
        )

        return Response(MyTaskSerializer(tickets, many=True).data, status=status.HTTP_200_OK)
