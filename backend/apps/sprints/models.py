from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q
from django.utils import timezone


class Sprint(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        "workspaces.Workspace",
        on_delete=models.CASCADE,
        related_name="sprints",
    )
    name = models.CharField(max_length=120)
    goal = models.CharField(max_length=255, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PLANNED)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace"],
                condition=Q(status="active"),
                name="unique_active_sprint_per_workspace",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.workspace_id}:{self.name}"
