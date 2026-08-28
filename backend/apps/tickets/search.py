"""`GET /api/v1/search/tickets/` -- stub (WP-0, Fase 3).

Deja el contrato reservado (ruta registrada, `IsAuthenticated`, forma de
respuesta) para que WP-A lo reescriba entero sin tocar
`apps/tickets/urls.py` de nuevo -- mismo patron que `apps/tickets/my_tasks.py`
uso en Fase 0 de Fase 2. `SEARCH_RESULT_LIMIT` ya vive aca porque WP-A lo
va a importar como el techo de `limit` (D16 de docs/PHASE_3_PLAN.md).
"""

from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

SEARCH_RESULT_LIMIT = 50


class SearchTicketsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response([])
