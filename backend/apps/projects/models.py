from __future__ import annotations

import uuid

from django.db import models
from django.db.models import Q
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
	# Identificador corto (ej. "TASK" en "TASK-123"). null=True de forma
	# permanente, no transitoria: proyectos legacy sin backfillear o casos
	# borde de derivacion son estados validos, no un TODO de migracion.
	key = models.CharField(max_length=10, null=True, blank=True)
	is_archived = models.BooleanField(default=False)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["-created_at"]
		constraints = [
			models.UniqueConstraint(
				fields=["workspace", "key"],
				condition=Q(key__isnull=False),
				name="unique_project_key_per_workspace",
			),
		]

	def __str__(self) -> str:
		return self.name


class WorkspaceStatus(models.Model):
	"""Columna de estado a nivel espacio: el tablero de sprint (que cruza
	varios proyectos) agrupa los tickets por estos estados, no por las
	columnas propias de cada proyecto. Cada `ProjectColumn` mapea a uno de
	estos estados (`ProjectColumn.workspace_status`), y `is_done` reemplaza
	al heuristico "ultima columna por order" para el progreso del sprint.
	"""

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	workspace = models.ForeignKey(
		"workspaces.Workspace",
		on_delete=models.CASCADE,
		related_name="statuses",
	)
	name = models.CharField(max_length=120)
	color = models.CharField(max_length=7, default="#64748B")
	order = models.PositiveIntegerField(default=1)
	is_done = models.BooleanField(default=False)
	# Los 3 estados por defecto (Backlog / En progreso / Completado) son
	# `is_system=True`: siempre existen, no se pueden renombrar ni eliminar.
	# Los estados extra que cree la gente son `is_system=False`.
	is_system = models.BooleanField(default=False)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["order", "created_at"]

	def __str__(self) -> str:
		return f"{self.workspace_id}:{self.name}"


class ProjectColumn(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	project = models.ForeignKey(
		Project,
		on_delete=models.CASCADE,
		related_name="columns",
	)
	# Mapeo al estado compartido del espacio. `null=True` de forma
	# permanente: una columna recien creada sin mapear, o proyectos legacy,
	# son estados validos -- el tablero de sprint simplemente no la muestra
	# hasta que se le asigne un estado.
	workspace_status = models.ForeignKey(
		WorkspaceStatus,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name="project_columns",
	)
	name = models.CharField(max_length=120)
	color = models.CharField(max_length=7, default="#64748B")
	order = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["order", "created_at"]

	def __str__(self) -> str:
		return f"{self.project.name} - {self.name}"
