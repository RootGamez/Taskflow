from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class Project(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	workspace = models.ForeignKey(
		"workspaces.Workspace",
		on_delete=models.CASCADE,
		related_name="projects",
	)
	name = models.CharField(max_length=255)
	description = models.TextField(blank=True)
	color = models.CharField(max_length=7, default="#2563EB")
	is_archived = models.BooleanField(default=False)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return self.name


class ProjectColumn(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	project = models.ForeignKey(
		Project,
		on_delete=models.CASCADE,
		related_name="columns",
	)
	name = models.CharField(max_length=120)
	color = models.CharField(max_length=7, default="#64748B")
	order = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["order", "created_at"]

	def __str__(self) -> str:
		return f"{self.project.name} - {self.name}"
