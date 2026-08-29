from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class WeeklyBoard(models.Model):
    """Pizarra de metas de una semana concreta de un espacio.

    Hay como mucho un board por (workspace, week_start) -- lo garantiza el
    constraint `unique_board_per_workspace_week`. `week_start` es siempre el
    lunes de la semana ISO, calculado server-side (RD-3): nunca se acepta del
    cliente.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        "workspaces.Workspace",
        on_delete=models.CASCADE,
        related_name="weekly_boards",
    )
    week_start = models.DateField()  # lunes (ISO) de esa semana
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_weekly_boards",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-week_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "week_start"],
                name="unique_board_per_workspace_week",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.workspace_id}:{self.week_start}"


class WeeklyGoalItem(models.Model):
    """Una meta dentro de una pizarra semanal.

    `order` lo asigna el servidor como `max(order) + 1` dentro de una
    transaccion (RG3) -- nunca se confia al cliente. `completed_by` /
    `completed_at` se rellenan en la transicion `is_done` false -> true y se
    limpian en true -> false (RD-2).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(
        WeeklyBoard,
        on_delete=models.CASCADE,
        related_name="items",
    )
    text = models.CharField(max_length=200)
    is_done = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_weekly_goal_items",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.board_id}:{self.text[:40]}"
