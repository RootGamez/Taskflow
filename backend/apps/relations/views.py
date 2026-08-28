"""Vistas de `apps.relations` (WP-C, Fase 3).

`GET`/`POST` en `TicketRelationListCreateView`, `DELETE` en
`TicketRelationDetailView`. Sin WebSocket ni `Activity` (D46, herencia de
D35/D3/D16 -- ver `docs/PHASE_3_PLAN.md` seccion 9).
"""

from __future__ import annotations

from django.db import IntegrityError
from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.projects.models import Project
from apps.relations.models import TicketRelation
from apps.relations.serializers import TicketRelationCreateSerializer, TicketRelationSerializer
from apps.relations.services import normalize_relation
from apps.tickets.models import Ticket
from apps.workspaces.access import WorkspaceRoleAccessMixin

# Mismo precedente que MAX_ACTIVITIES_RETURNED (activities/views.py:16) y
# el limite de 100 subtareas de WP-B (D34): protege la ruta caliente del
# `GET` (RC9/D45 del plan tecnico).
MAX_RELATIONS_PER_TICKET = 50

# Sufijo del mensaje de error para el reciproco DIRECTO de `blocks`/
# `duplicate_of` (D42, RC2). `relates_to` no aparece aca: su espejo se
# trata como un duplicado comun (D41), no como un reciproco con mensaje
# propio.
_RECIPROCAL_ERROR_SUFFIX = {
    TicketRelation.Type.BLOCKS: "ya bloquea a este ticket.",
    TicketRelation.Type.DUPLICATE_OF: "ya es un duplicado de este ticket.",
}

_RELATION_SELECT_RELATED = (
    "from_ticket__project",
    "from_ticket__column",
    "to_ticket__project",
    "to_ticket__column",
)


def _get_ticket_or_404(project: Project, ticket_id: str) -> Ticket:
    ticket = project.tickets.filter(id=ticket_id).first()
    if ticket is None:
        raise NotFound("Ticket no encontrado.")
    return ticket


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _ticket_label(ticket: Ticket) -> str:
    # Duplica a proposito las 2 lineas de `TicketSerializer.get_reference`
    # (`apps/tickets/serializers.py`, zona prohibida) -- mismo criterio que
    # `RelatedTicketSerializer.get_reference` en `serializers.py`.
    if ticket.project.key and ticket.number:
        return f"{ticket.project.key}-{ticket.number}"
    return ticket.title


class TicketRelationListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        ticket = _get_ticket_or_404(project, ticket_id)

        # D39: el listado es `outgoing_relations ∪ incoming_relations`.
        relations = TicketRelation.objects.filter(Q(from_ticket=ticket) | Q(to_ticket=ticket)).select_related(
            *_RELATION_SELECT_RELATED
        )
        serializer = TicketRelationSerializer(relations, many=True, context={"ticket_id": str(ticket.id)})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request: Request, project_id: str, ticket_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = _get_ticket_or_404(project, ticket_id)

        serializer = TicketRelationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear la relacion.")

        relation_type = serializer.validated_data["relation_type"]
        other_ticket_id = serializer.validated_data["ticket_id"]

        if str(other_ticket_id) == str(ticket.id):
            raise ValidationError({"detail": "Un ticket no puede relacionarse consigo mismo."})

        # Busqueda SIN scope de proyecto/workspace a proposito (D40/RC7): la
        # comparacion explicita de abajo (`other_ticket.project_id !=
        # project.id`) es la unica que decide 400, nunca 404 por ese
        # motivo -- asi el mensaje nunca revela si el ticket "no existe en
        # absoluto" o "existe en otro proyecto/workspace", y jamas incluye
        # su titulo (evita el canal de enumeracion cross-proyecto que D40
        # documenta como riesgo de seguridad, no de alcance).
        other_ticket = Ticket.objects.select_related("project", "column").filter(id=other_ticket_id).first()
        if other_ticket is None:
            raise NotFound("Ticket relacionado no encontrado.")
        if other_ticket.project_id != project.id:
            raise ValidationError({"detail": "Solo se pueden relacionar tickets del mismo proyecto."})

        existing_count = TicketRelation.objects.filter(Q(from_ticket=ticket) | Q(to_ticket=ticket)).count()
        if existing_count >= MAX_RELATIONS_PER_TICKET:
            raise ValidationError({"detail": "Un ticket no puede tener mas de 50 relaciones."})

        from_ticket, to_ticket, stored_type = normalize_relation(ticket, other_ticket, relation_type)

        exact_duplicate_exists = TicketRelation.objects.filter(
            from_ticket=from_ticket, to_ticket=to_ticket, relation_type=stored_type
        ).exists()
        if exact_duplicate_exists:
            raise ValidationError({"detail": "Esa relacion ya existe."})

        # La fila "opuesta" (from/to invertidos, mismo tipo) tiene un
        # significado distinto segun el tipo:
        # - `relates_to` es simetrico (D41): la fila opuesta ES la misma
        #   relacion, se rechaza igual que un duplicado exacto.
        # - `blocks`/`duplicate_of` NO son simetricos (D42): la fila
        #   opuesta es un reciproco DIRECTO (deadlock logico), con su
        #   propio mensaje. Los ciclos transitivos (A->B->C->A) no se
        #   detectan en v1 -- ver test_transitive_cycle_is_allowed_in_v1.
        opposite_relation = TicketRelation.objects.filter(
            from_ticket=to_ticket, to_ticket=from_ticket, relation_type=stored_type
        ).first()
        if opposite_relation is not None:
            if stored_type == TicketRelation.Type.RELATES_TO:
                raise ValidationError({"detail": "Esa relacion ya existe."})
            suffix = _RECIPROCAL_ERROR_SUFFIX[stored_type]
            raise ValidationError({"detail": f"{_ticket_label(other_ticket)} {suffix}"})

        try:
            relation = TicketRelation.objects.create(
                from_ticket=from_ticket,
                to_ticket=to_ticket,
                relation_type=stored_type,
                created_by=request.user,
            )
        except IntegrityError:
            # Segunda linea de defensa contra la carrera de dos POST
            # concurrentes con la misma tupla (patron labels/views.py:52-55,
            # RC4 del plan tecnico): la constraint `unique_ticket_relation`
            # es la fuente de verdad real.
            raise ValidationError({"detail": "Esa relacion ya existe."})

        relation = TicketRelation.objects.select_related(*_RELATION_SELECT_RELATED).get(id=relation.id)
        output = TicketRelationSerializer(relation, context={"ticket_id": str(ticket.id)}).data
        return Response(output, status=status.HTTP_201_CREATED)


class TicketRelationDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request: Request, project_id: str, ticket_id: str, relation_id: str) -> Response:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = _get_ticket_or_404(project, ticket_id)

        # D44: acepta relaciones donde `ticket_id` es CUALQUIERA de los dos
        # extremos. Sin este `Q(...) | Q(...)`, una relacion "Bloqueado
        # por" (fila entrante, `to_ticket=ticket`) seria imborrable desde
        # el ticket que la muestra -- el bug mas obvio de esta feature
        # (RC8).
        relation = TicketRelation.objects.filter(Q(from_ticket=ticket) | Q(to_ticket=ticket), id=relation_id).first()
        if relation is None:
            raise NotFound("Relacion no encontrada.")

        # D43: cualquiera con rol escritor puede borrar cualquier relacion,
        # no solo quien la creo (`assert_project_write_access` de arriba ya
        # lo garantiza) -- a diferencia de comentarios, una relacion es
        # metadato compartido del proyecto, no contenido de autoria.
        relation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
