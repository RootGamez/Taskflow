from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class SubTask(models.Model):
    """Checklist estructurado dentro de un `Ticket` (WP-B, Fase 3).

    `order` es de solo lectura desde la API v1 (D30 de
    docs/PHASE_3_PLAN.md): se asigna `max(order)+1` al crear y no hay
    endpoint de reordenamiento. El campo vive en el modelo desde el dia 1
    para no necesitar una migracion cuando llegue el follow-up.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        "tickets.Ticket",
        on_delete=models.CASCADE,
        related_name="subtasks",
    )
    title = models.CharField(max_length=255)
    is_done = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=1)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_subtasks",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_subtasks",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "created_at"]
        indexes = [models.Index(fields=["ticket", "order"])]

    def __str__(self) -> str:
        return f"{self.ticket_id}:{self.title}"
