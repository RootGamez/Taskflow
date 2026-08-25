from __future__ import annotations

from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.activities.serializers import ActivitySerializer
from apps.workspaces.access import WorkspaceRoleAccessMixin

# Límite duro de filas devueltas: sin esto, un ticket viejo con una
# coalescencia rota (o simplemente mucho historial) podría devolver miles
# de filas en un solo GET.
MAX_ACTIVITIES_RETURNED = 200


class TicketActivityListView(WorkspaceRoleAccessMixin, APIView):
    """Solo lectura: GET projects/<project_id>/tickets/<ticket_id>/activities/.

    Sin POST/PATCH/DELETE — las actividades se generan exclusivamente desde
    `apps.tickets.serializers` (y `apps.comments` para `commented`), nunca
    directo desde esta API.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        ticket = project.tickets.filter(id=ticket_id).first()
        if ticket is None:
            raise NotFound("Ticket no encontrado.")

        activities = ticket.activities.select_related("actor")[:MAX_ACTIVITIES_RETURNED]
        return Response(ActivitySerializer(activities, many=True).data, status=status.HTTP_200_OK)
