from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class TicketRelation(models.Model):
    """Relacion dirigida entre dos tickets (WP-C, Fase 3).

    Solo 3 valores viven en la DB (D38 de docs/PHASE_3_PLAN.md):
    `blocked_by` y `duplicated_by` NO se almacenan, son la vista inversa de
    `blocks` / `duplicate_of` que resuelve `apps.relations.services` segun
    la perspectiva del ticket consultado. Con una unica forma canonica, la
    constraint de unicidad de la DB es la fuente de verdad real.
    """

    class Type(models.TextChoices):
        BLOCKS = "blocks", "Blocks"
        RELATES_TO = "relates_to", "Relates to"
        DUPLICATE_OF = "duplicate_of", "Duplicate of"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_ticket = models.ForeignKey(
        "tickets.Ticket",
        on_delete=models.CASCADE,
        related_name="outgoing_relations",
    )
    to_ticket = models.ForeignKey(
        "tickets.Ticket",
        on_delete=models.CASCADE,
        related_name="incoming_relations",
    )
    relation_type = models.CharField(max_length=16, choices=Type.choices)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_ticket_relations",
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["from_ticket", "to_ticket", "relation_type"],
                name="unique_ticket_relation",
            ),
            models.CheckConstraint(
                check=~models.Q(from_ticket=models.F("to_ticket")),
                name="ticket_relation_not_self",
            ),
        ]
        indexes = [
            models.Index(fields=["from_ticket"]),
            models.Index(fields=["to_ticket"]),
        ]

    def __str__(self) -> str:
        return f"{self.from_ticket_id} {self.relation_type} {self.to_ticket_id}"
