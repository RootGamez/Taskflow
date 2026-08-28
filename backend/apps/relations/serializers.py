"""Serializers de `apps.relations` (WP-C, Fase 3)."""

from __future__ import annotations

from rest_framework import serializers

from apps.relations.services import resolve_relation_type


class RelatedTicketSerializer(serializers.Serializer):
    """Ticket embebido en el payload de una relacion.

    Siempre el OTRO extremo, nunca el ticket consultado (D39). Lean a
    proposito -- mismo espiritu que `SearchResultSerializer` de WP-A (D17):
    solo lo que `RelationBadge` necesita renderizar (`reference`, `title`,
    `priority`, `column_name` -- DESIGN_SYSTEM.md, D48 del plan tecnico).
    Asume que el objeto ya viene con `select_related("project", "column")`
    desde el call site (`views.py`) -- no dispara queries nuevas aca.
    """

    id = serializers.UUIDField()
    title = serializers.CharField()
    priority = serializers.CharField()
    reference = serializers.SerializerMethodField()
    column_name = serializers.SerializerMethodField()

    def get_reference(self, ticket) -> str | None:
        # Duplica a proposito las 2 lineas de
        # `TicketSerializer.get_reference` (`apps/tickets/serializers.py`,
        # zona prohibida para este agente) en vez de importarlo -- mismo
        # criterio que D24/D57 de docs/PHASE_3_PLAN.md: duplicacion
        # deliberada de una linea vs. acoplarse a otro agente en paralelo.
        if ticket.project.key and ticket.number:
            return f"{ticket.project.key}-{ticket.number}"
        return None

    def get_column_name(self, ticket) -> str:
        return ticket.column.name


class TicketRelationSerializer(serializers.Serializer):
    """Fila de `TicketRelation` resuelta desde la perspectiva de
    `context["ticket_id"]` (D39). `relation_type` es la etiqueta resuelta
    (puede tomar los 5 valores); `stored_type` es siempre uno de los 3
    valores reales que vive en la DB (D38).
    """

    id = serializers.UUIDField(read_only=True)
    relation_type = serializers.SerializerMethodField()
    stored_type = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()
    ticket = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)

    def get_relation_type(self, obj) -> str:
        return resolve_relation_type(obj, self.context["ticket_id"])

    def get_stored_type(self, obj) -> str:
        return obj.relation_type

    def get_direction(self, obj) -> str:
        is_outgoing = str(obj.from_ticket_id) == str(self.context["ticket_id"])
        return "outgoing" if is_outgoing else "incoming"

    def get_ticket(self, obj) -> dict:
        ticket_id = self.context["ticket_id"]
        other = obj.to_ticket if str(obj.from_ticket_id) == str(ticket_id) else obj.from_ticket
        return RelatedTicketSerializer(other).data


class TicketRelationCreateSerializer(serializers.Serializer):
    """Valida solo la FORMA del payload de creacion.

    Los 5 valores aceptados de `relation_type` (D38) y que `ticket_id` sea
    un UUID. Las reglas de negocio (auto-relacion, mismo proyecto, limite
    de 50, duplicados, reciprocos directos -- D40 a D45) viven en
    `views.py` porque dependen de lecturas a la DB scopeadas por
    `project`/`ticket`, siguiendo el mismo criterio que
    `TicketCreateSerializer.validate_column_id` en `apps/tickets/serializers.py`
    (zona prohibida para este agente, por eso no se subclasea ni se
    importa).
    """

    relation_type = serializers.ChoiceField(
        choices=("blocks", "blocked_by", "relates_to", "duplicate_of", "duplicated_by"),
        error_messages={
            "required": "El tipo de relacion es obligatorio.",
            "invalid_choice": "Tipo de relacion invalido.",
        },
    )
    ticket_id = serializers.UUIDField(
        error_messages={"required": "Debes indicar el ticket a relacionar."},
    )
