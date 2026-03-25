from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
	class Type(models.TextChoices):
		WORKSPACE_INVITATION = "workspace_invitation", "Workspace invitation"

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	recipient = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="notifications",
	)
	actor = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		related_name="sent_notifications",
		null=True,
		blank=True,
	)
	notification_type = models.CharField(max_length=50, choices=Type.choices)
	title = models.CharField(max_length=255)
	message = models.TextField(blank=True)
	data = models.JSONField(default=dict, blank=True)
	is_read = models.BooleanField(default=False)
	read_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-created_at"]

	def mark_as_read(self) -> None:
		if self.is_read:
			return
		self.is_read = True
		self.read_at = timezone.now()
		self.save(update_fields=["is_read", "read_at"])
