from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Ticket(models.Model):
	class Priority(models.TextChoices):
		URGENT = "urgent", "Urgent"
		HIGH = "high", "High"
		MEDIUM = "medium", "Medium"
		LOW = "low", "Low"
		NONE = "none", "None"

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	project = models.ForeignKey(
		"projects.Project",
		on_delete=models.CASCADE,
		related_name="tickets",
	)
	column = models.ForeignKey(
		"projects.ProjectColumn",
		on_delete=models.CASCADE,
	)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		related_name="created_tickets",
	)
	title = models.CharField(max_length=255)
	description = models.TextField(blank=True)
	progress_notes = models.TextField(blank=True)
	priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NONE)
	due_date = models.DateTimeField(null=True, blank=True)
	order = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["order", "created_at"]

	def __str__(self) -> str:
		return self.title


class TicketFieldLock(models.Model):
	ticket = models.ForeignKey(
		Ticket,
		on_delete=models.CASCADE,
		related_name="field_locks",
	)
	field = models.CharField(max_length=64)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="ticket_field_locks",
	)
	user_name = models.CharField(max_length=255)
	expires_at = models.DateTimeField()
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=["ticket", "field"], name="unique_ticket_field_lock"),
		]

	def __str__(self) -> str:
		return f"{self.ticket_id}:{self.field} - {self.user_id}"
