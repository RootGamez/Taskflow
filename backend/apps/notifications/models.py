from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
	class Type(models.TextChoices):
		WORKSPACE_INVITATION = "workspace_invitation", "Workspace invitation"
		WORKSPACE_DELETED = "workspace_deleted", "Workspace deleted"
		WORKSPACE_MEMBER_REMOVED = "workspace_member_removed", "Workspace member removed"
		TICKET_ASSIGNED = "ticket_assigned", "Ticket assigned"
		TICKET_MENTIONED = "ticket_mentioned", "Ticket mentioned"
		TICKET_COMMENTED = "ticket_commented", "Ticket commented"

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
	# Sello del envio por correo. NULL = todavia no salio. Es lo que le
	# permite al resumen (`apps.notifications.delivery`) saber que queda
	# pendiente y no mandar dos veces lo mismo -- la reserva en cache solo
	# agrupa, la verdad de que falta mandar esta aca. Las notificaciones
	# que no viajan por correo lo dejan en NULL para siempre; la consulta
	# del resumen las excluye por tipo.
	email_sent_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-created_at"]
		indexes = [
			models.Index(fields=["recipient", "-created_at"]),
			# Indice parcial: la consulta del resumen solo mira las que
			# siguen sin mandarse, que son un punado frente al historico.
			models.Index(
				fields=["recipient"],
				condition=models.Q(email_sent_at__isnull=True),
				name="notif_pending_email_idx",
			),
		]

	def mark_as_read(self) -> None:
		if self.is_read:
			return
		self.is_read = True
		self.read_at = timezone.now()
		self.save(update_fields=["is_read", "read_at"])
