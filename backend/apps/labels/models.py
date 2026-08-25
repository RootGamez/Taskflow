from __future__ import annotations

import uuid

from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone


class Label(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="labels",
    )
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=7)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", Lower("name")],
                name="unique_label_name_per_project",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.project_id}:{self.name}"
