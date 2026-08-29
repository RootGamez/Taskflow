from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
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
	assignees = models.ManyToManyField(
		settings.AUTH_USER_MODEL,
		related_name="assigned_tickets",
		blank=True,
	)
	# Un ticket puede pertenecer a varios sprints a la vez: si no se cierra
	# en el sprint 1, "arrastra" al sprint 2 sin perder la trazabilidad de
	# que se empezo en el 1. Borrar un sprint solo lo quita de esta relacion
	# (M2M), nunca borra ni toca el ticket.
	sprints = models.ManyToManyField(
		"sprints.Sprint",
		related_name="tickets",
		blank=True,
	)
	labels = models.ManyToManyField(
		"labels.Label",
		blank=True,
		related_name="tickets",
	)
	# Identificador secuencial por proyecto (ej. el "123" de "TASK-123").
	# Nullable de forma permanente por el mismo motivo que `Project.key`:
	# tickets legacy sin backfillear, o proyectos sin key propio, son
	# estados validos.
	number = models.PositiveIntegerField(null=True, blank=True)
	title = models.CharField(max_length=255)
	description = models.TextField(blank=True)
	# Texto plano extraido del JSON de Tiptap de `description`
	# (apps.tickets.rich_text.extract_plain_text), para que la busqueda por
	# descripcion (WP-A) no tenga que hacer `icontains` sobre el blob JSON
	# crudo. `blank=True, default=""` -- nunca NULL -- para que el filtro
	# sea uniforme (docs/PHASE_3_PLAN.md D9). Se recalcula en
	# TicketCreateSerializer/TicketUpdateSerializer (D11), nunca aca ni en
	# un signal.
	description_text = models.TextField(blank=True, default="")
	progress_notes = models.TextField(blank=True)
	priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NONE)
	due_date = models.DateTimeField(null=True, blank=True)
	order = models.PositiveIntegerField(default=1)
	created_at = models.DateTimeField(default=timezone.now)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ["order", "created_at"]
		constraints = [
			models.UniqueConstraint(
				fields=["project", "number"],
				condition=Q(number__isnull=False),
				name="unique_ticket_number_per_project",
			),
		]

	def __str__(self) -> str:
		return self.title


class TicketNumberSequence(models.Model):
	"""Contador persistente de `Ticket.number` por proyecto.

	Desviacion deliberada sobre la formula original ("Max(number) + 1"):
	un `Max()` calculado solo sobre las filas de `Ticket` vivas en un
	momento dado NO garantiza "los numeros nunca se reutilizan" cuando se
	borra justo el ticket con el numero mas alto -- el siguiente `Max()`
	cae al numero anterior y lo repite. Este contador vive fuera de la
	tabla `Ticket` a proposito: sobrevive al borrado de cualquier ticket,
	incluido el de numero mas alto. Ver `apps.tickets.numbering` para el
	uso atomico (con el lock explicito sobre `Project` que pide la
	especificacion) y el resumen de la tanda para el detalle completo.
	"""

	project = models.OneToOneField(
		"projects.Project",
		on_delete=models.CASCADE,
		related_name="ticket_number_sequence",
	)
	last_value = models.PositiveIntegerField(default=0)

	def __str__(self) -> str:
		return f"{self.project_id}:{self.last_value}"


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


class TicketImage(models.Model):
	"""Imagen subida al contenido de un ticket, almacenada en MinIO."""

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	ticket = models.ForeignKey(
		Ticket,
		on_delete=models.CASCADE,
		related_name="images",
	)
	uploaded_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		related_name="uploaded_ticket_images",
	)
	# Clave del objeto en MinIO (ej. tickets/<uuid>/images/<uuid>.jpg)
	object_key = models.CharField(max_length=512)
	# URL pública accesible desde el frontend
	url = models.URLField(max_length=2000)
	file_name = models.CharField(max_length=255, blank=True)
	content_type = models.CharField(max_length=100, blank=True)
	file_size = models.PositiveIntegerField(default=0)  # bytes
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return f"{self.ticket_id} - {self.file_name or self.id}"


class TicketVideo(models.Model):
	"""Video subido al contenido de un ticket, almacenado en MinIO."""

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	ticket = models.ForeignKey(
		Ticket,
		on_delete=models.CASCADE,
		related_name="videos",
	)
	uploaded_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		related_name="uploaded_ticket_videos",
	)
	object_key = models.CharField(max_length=512)
	url = models.URLField(max_length=2000)
	file_name = models.CharField(max_length=255, blank=True)
	content_type = models.CharField(max_length=100, blank=True)
	file_size = models.PositiveIntegerField(default=0)  # bytes
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return f"{self.ticket_id} - {self.file_name or self.id}"
