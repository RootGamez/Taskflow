"""Stub de Fase 0 para "Mis tareas" (ver docs/DESIGN_SYSTEM.md, seccion 8.3).

Implementacion real: Agente C, en paralelo. Este endpoint solo existe aca
para reservar la ruta `tickets/mine/` y confirmar que no colisiona con
`projects/<uuid:project_id>/tickets/<uuid:ticket_id>/` (el converter
`uuid` no matchea el string literal "mine", asi que ambas rutas coexisten
sin ambiguedad).

Contrato para el Agente C (anti N+1, ver seccion 0.9 del resumen de la
tanda): el queryset real debe usar el mismo patron que
`TicketListCreateView.get` -- `select_related("project", "column",
"created_by", "sprint")` + `prefetch_related("assignees", "labels")` --
filtrando por `assignees=request.user` a traves de todos los proyectos
donde el usuario es miembro del workspace, no solo un proyecto.
"""

from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class MyTasksView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response([])  # TODO(Agente C): implementacion real
