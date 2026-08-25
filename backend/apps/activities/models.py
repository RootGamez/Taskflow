from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Activity(models.Model):
    class Action(models.TextChoices):
        CREATED = "created", "Created"
        STATUS_CHANGED = "status_changed", "Status changed"
        PRIORITY_CHANGED = "priority_changed", "Priority changed"
        ASSIGNED = "assigned", "Assigned"
        UNASSIGNED = "unassigned", "Unassigned"
        DUE_DATE_CHANGED = "due_date_changed", "Due date changed"
        TITLE_CHANGED = "title_changed", "Title changed"
        COMMENTED = "commented", "Commented"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey("tickets.Ticket", on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="ticket_activities",
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    from_value = models.JSONField(null=True, blank=True)
    to_value = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["ticket", "-created_at"])]

    def __str__(self) -> str:
        return f"{self.ticket_id}:{self.action}"
