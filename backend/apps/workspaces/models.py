from __future__ import annotations

import uuid
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify


def workspace_invitation_default_expiration():
	return timezone.now() + timedelta(days=7)


class Workspace(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	name = models.CharField(max_length=255)
	slug = models.SlugField(max_length=255, unique=True)
	logo_url = models.URLField(blank=True)
	owner = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="owned_workspaces",
	)
	created_at = models.DateTimeField(default=timezone.now)

	class Meta:
		ordering = ["-created_at"]

	def save(self, *args, **kwargs):
		if not self.slug:
			base_slug = slugify(self.name)[:200] or "workspace"
			slug = base_slug
			suffix = 1
			while Workspace.objects.filter(slug=slug).exclude(pk=self.pk).exists():
				slug = f"{base_slug}-{suffix}"
				suffix += 1
			self.slug = slug

		super().save(*args, **kwargs)

	def __str__(self):
		return self.name


class WorkspaceMemberManager(models.Manager):
	"""Manager por defecto: oculta a los miembros expulsados (soft-delete).

	Expulsar a alguien de un espacio (WorkspaceMemberDetailView.delete) NO
	borra la fila -- le pone role=REMOVED para no dejar tickets huerfanos
	(sus assignees son un M2M a User, no a WorkspaceMember, asi que sobreviven
	intactos). Con este manager como `objects`, TODO el resto del codebase
	(listado de workspaces del usuario, checks de acceso a proyecto/ticket,
	menciones de comentarios, asignacion de subtareas, consumers de
	websocket, etc.) sigue tratando a un miembro expulsado como "ya no es
	miembro" sin tener que tocar cada uno de esos call sites uno por uno.
	Dos excepciones que SI necesitan verlos: la pantalla de miembros (para
	listar la seccion "Miembros eliminados") y la reactivacion al aceptar
	una nueva invitacion -- ambas usan `all_objects` explicitamente.

	Ojo: esta exclusion solo aplica cuando se consulta a traves de este
	manager (`WorkspaceMember.objects...` o `instance.memberships.all()`).
	No aplica a lookups que atraviesan la relacion en un `.filter()` de OTRO
	modelo (p. ej. `Project.objects.filter(workspace__memberships__user=..)`)
	-- Django arma esos JOIN sobre la tabla cruda, sin pasar por el manager.
	Los 2 call sites del codebase que atraviesan `memberships` asi
	(`WorkspaceRoleAccessMixin.get_project_for_user`,
	`TicketSingleView.get`) filtran el rol removido a mano.
	"""

	def get_queryset(self):
		return super().get_queryset().exclude(role=self.model.Role.REMOVED)


class WorkspaceMember(models.Model):
	class Role(models.TextChoices):
		OWNER = "owner", "Owner"
		ADMIN = "admin", "Admin"
		MEMBER = "member", "Member"
		VIEWER = "viewer", "Viewer"
		# Estado, no un rol real: revoca todo permiso (queda fuera de
		# WRITABLE_ROLES/MANAGE_MEMBER_ROLES/EDITABLE_ROLES en access.py y
		# views.py sin tener que listarlo explicitamente en ningun lado) y
		# hace que `objects` (ver WorkspaceMemberManager) lo trate como si
		# no fuera miembro. La fila se conserva -- no un hard delete -- para
		# no dejar tickets huerfanos y para poder mostrarlo en "Miembros
		# eliminados".
		REMOVED = "removed", "Removed"

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	workspace = models.ForeignKey(
		Workspace,
		on_delete=models.CASCADE,
		related_name="memberships",
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="workspace_memberships",
	)
	role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
	is_active = models.BooleanField(default=False)
	created_at = models.DateTimeField(default=timezone.now)

	objects = WorkspaceMemberManager()
	# Ve TODO, removidos incluidos -- usar solo en la pantalla de miembros
	# (seccion "eliminados"), la reactivacion al aceptar una invitacion, y
	# el admin de Django.
	all_objects = models.Manager()

	class Meta:
		ordering = ["-created_at"]
		unique_together = (("workspace", "user"),)

	def __str__(self):
		return f"{self.user} - {self.workspace} ({self.role})"


class WorkspaceInvitation(models.Model):
	class Status(models.TextChoices):
		PENDING = "pending", "Pending"
		ACCEPTED = "accepted", "Accepted"
		REJECTED = "rejected", "Rejected"
		CANCELLED = "cancelled", "Cancelled"
		EXPIRED = "expired", "Expired"

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	workspace = models.ForeignKey(
		Workspace,
		on_delete=models.CASCADE,
		related_name="invitations",
	)
	invited_user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="workspace_invitations",
	)
	invited_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name="sent_workspace_invitations",
	)
	role = models.CharField(max_length=20, choices=WorkspaceMember.Role.choices, default=WorkspaceMember.Role.MEMBER)
	status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
	invitation_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
	notification = models.OneToOneField(
		"notifications.Notification",
		on_delete=models.SET_NULL,
		related_name="workspace_invitation",
		null=True,
		blank=True,
	)
	created_at = models.DateTimeField(default=timezone.now)
	expires_at = models.DateTimeField(default=workspace_invitation_default_expiration)
	responded_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ["-created_at"]
		constraints = [
			models.UniqueConstraint(
				fields=["workspace", "invited_user"],
				condition=Q(status="pending"),
				name="unique_pending_workspace_invitation",
			)
		]

	def __str__(self):
		return f"Invite {self.invited_user} to {self.workspace} ({self.status})"
