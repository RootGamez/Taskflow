from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

# Import cross-app deliberado (docs/PHASE_4_PLAN.md, nota bajo el modelo):
# reusa los choices de prioridad de Ticket en vez de duplicarlos, evitando
# dos fuentes de verdad que se desincronizan. Direccion unica y segura:
# `apps.tickets.models` no importa nada de `apps.tickettemplates` (la
# dependencia real de plantillas hacia tickets vive en
# `apps.tickets.serializers` -> `apps.tickettemplates.services`, nunca en
# sentido contrario) -- verificado con `python manage.py check` (R0A-5).
from apps.tickets.models import Ticket


class TicketTemplate(models.Model):
    """Plantilla reusable para precargar tickets nuevos (D22: una
    plantilla es una fabrica, no una relacion -- NO existe `Ticket.
    template`, editar o borrar una plantilla no afecta tickets ya
    creados con ella).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="ticket_templates",
    )
    name = models.CharField(max_length=80)
    title_template = models.CharField(max_length=255, blank=True, default="")
    description = models.TextField(blank=True, default="")  # JSON de Tiptap
    priority = models.CharField(max_length=10, choices=Ticket.Priority.choices, default=Ticket.Priority.NONE)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_ticket_templates",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            # Forma posicional con Lower(): `UniqueConstraint.fields` no
            # acepta expresiones (solo nombres de campo). Nota ya
            # documentada en apps/labels/models.py:24-30 -- `fields=[...]`
            # con `Lower("name")` adentro falla en migrate con
            # `FieldDoesNotExist`. "project" como string se envuelve
            # automaticamente en `F("project")`.
            models.UniqueConstraint(
                "project",
                Lower("name"),
                name="unique_ticket_template_name_per_project",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.project_id}:{self.name}"


class TicketTemplateItem(models.Model):
    """Item de checklist de una plantilla (D21: se edita como una lista de
    strings desde la API, pero se persiste como filas -- `apply_template_
    items` necesita `order`, y migrar de "lineas de texto" a filas mas
    adelante seria un backfill).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template = models.ForeignKey(
        TicketTemplate,
        on_delete=models.CASCADE,
        related_name="items",
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]
        indexes = [models.Index(fields=["template", "order"])]

    def __str__(self) -> str:
        return f"{self.template_id}:{self.title}"
