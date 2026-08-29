"""`GET /api/v1/search/tickets/` -- busqueda global de tickets (WP-A, Fase 3).

Reescritura completa del stub de WP-0 (docs/PHASE_3_PLAN.md, seccion 4).
`SEARCH_RESULT_LIMIT` se conserva con el mismo nombre y valor que dejo el
stub -- es el techo de `limit` (D16).

Decisiones clave (ver el plan para el detalle completo):
- D16: parametros invalidos degradan, nunca 400. `q` corto -> `[]`; `limit`
  fuera de rango o no numerico -> clamp/valor por defecto. El palette
  dispara una request por pulsacion (debounced); un 400 produciria un
  toast de error mientras el usuario escribe.
- D17: `SearchResultSerializer` es propio y lean (7 campos), NO subclasea
  `TicketSerializer` (que incluye el blob JSON de `description`, labels,
  assignees -- desperdicio de red por pulsacion).
- D18: ranking con `Case/When`, portable entre SQLite y Postgres. Nada de
  `SearchVector`/`TrigramSimilarity` (`django.contrib.postgres` no esta en
  INSTALLED_APPS y los tests corren en SQLite).
- D19: busqueda exacta por referencia ("TASK-142") con rango 0.
- D20: el scope de visibilidad replica LITERALMENTE el patron de
  `apps/tickets/my_tasks.py` -- subquery de `WorkspaceMember`, sin
  `.distinct()`, excluye proyectos archivados. Es la superficie de mas
  riesgo de seguridad de toda la fase (RA1): un usuario jamas debe poder
  encontrar por busqueda un ticket de un workspace del que no es miembro.
"""

from __future__ import annotations

import re

from django.db.models import Case, IntegerField, Q, QuerySet, Value, When
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tickets.models import Ticket
from apps.workspaces.models import WorkspaceMember

# Techo de `limit` (D16). El stub de WP-0 ya definia este nombre/valor --
# se conserva para no romper ningun import externo hecho contra el stub.
SEARCH_RESULT_LIMIT = 50
SEARCH_DEFAULT_LIMIT = 20
SEARCH_MIN_QUERY_LENGTH = 2

# "TASK-142" -> ("TASK", 142). El key del proyecto es alfanumerico
# (`Project.key`), el numero es siempre entero positivo (`Ticket.number`).
_REFERENCE_PATTERN = re.compile(r"^\s*([A-Za-z][A-Za-z0-9]*)-(\d+)\s*$")


class SearchResultSerializer(serializers.Serializer):
    """Forma de respuesta lean y propia (D17) -- 7 campos, sin `description`."""

    id = serializers.UUIDField()
    title = serializers.CharField()
    reference = serializers.SerializerMethodField()
    priority = serializers.CharField()
    due_date = serializers.DateTimeField()
    column_name = serializers.CharField(source="column.name")
    project = serializers.SerializerMethodField()

    def get_reference(self, obj: Ticket) -> str | None:
        # Asume `select_related("project")` desde el call site -- no
        # dispara una query nueva aca (mismo contrato que
        # `TicketSerializer.get_reference`).
        if obj.project.key and obj.number:
            return f"{obj.project.key}-{obj.number}"
        return None

    def get_project(self, obj: Ticket) -> dict:
        project = obj.project
        return {
            "id": str(project.id),
            "name": project.name,
            "key": project.key,
            "color": project.color,
            "workspace_slug": project.workspace.slug,
        }


def _clamp_limit(raw_limit: str | None) -> int:
    """`limit` invalido o fuera de rango degrada, nunca 400 (D16)."""
    if raw_limit is None:
        return SEARCH_DEFAULT_LIMIT
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        return SEARCH_DEFAULT_LIMIT
    return max(1, min(limit, SEARCH_RESULT_LIMIT))


def _parse_reference_query(query: str) -> tuple[str, int] | None:
    """Extrae `(key, numero)` de una query con forma de referencia exacta."""
    match = _REFERENCE_PATTERN.match(query)
    if match is None:
        return None
    key, raw_number = match.groups()
    return key, int(raw_number)


def _build_rank_annotation(query: str, reference_q: Q | None):
    """Ranking determinista en la DB (D18): referencia exacta primero,
    luego titulo que empieza con la query, luego titulo que la contiene,
    y por ultimo (default) el resto -- que solo puede haber matcheado por
    `description_text` (el filtro base ya lo garantiza). `istartswith`/
    `icontains` funcionan identico en SQLite y Postgres.
    """
    whens = []
    if reference_q is not None:
        whens.append(When(reference_q, then=Value(0)))
    whens.append(When(title__istartswith=query, then=Value(1)))
    whens.append(When(title__icontains=query, then=Value(2)))

    return Case(*whens, default=Value(3), output_field=IntegerField())


class SearchTicketsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        raw_query = request.query_params.get("q") or ""
        query = raw_query.strip()
        if len(query) < SEARCH_MIN_QUERY_LENGTH:
            return Response([])

        limit = _clamp_limit(request.query_params.get("limit"))

        # Subquery de workspace ids en vez de un JOIN sobre memberships
        # (D20, mismo patron que `apps/tickets/my_tasks.py`): sin
        # `.distinct()`, que combinado con `order_by` sobre campos
        # relacionados puede romper la deduplicacion en silencio.
        member_workspace_ids = WorkspaceMember.objects.filter(user=request.user).values_list(
            "workspace_id", flat=True
        )
        tickets: QuerySet[Ticket] = Ticket.objects.filter(
            project__workspace_id__in=member_workspace_ids
        ).exclude(project__is_archived=True)

        workspace_slug = request.query_params.get("workspace")
        if workspace_slug:
            is_member = WorkspaceMember.objects.filter(
                user=request.user, workspace__slug=workspace_slug
            ).exists()
            if not is_member:
                raise NotFound("Workspace no encontrado.")
            tickets = tickets.filter(project__workspace__slug=workspace_slug)

        reference_match = _parse_reference_query(query)
        reference_q: Q | None = None
        if reference_match is not None:
            key, number = reference_match
            reference_q = Q(project__key__iexact=key, number=number)

        text_q = Q(title__icontains=query) | Q(description_text__icontains=query)
        match_q = (reference_q | text_q) if reference_q is not None else text_q

        rank = _build_rank_annotation(query, reference_q)

        results = (
            tickets.filter(match_q)
            .select_related("project", "project__workspace", "column__workspace_status")
            .annotate(rank=rank)
            .order_by("rank", "project__name", "-updated_at")[:limit]
        )

        return Response(SearchResultSerializer(results, many=True).data)
