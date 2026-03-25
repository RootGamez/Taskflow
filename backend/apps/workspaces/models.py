from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify


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


class WorkspaceMember(models.Model):
	class Role(models.TextChoices):
		OWNER = "owner", "Owner"
		ADMIN = "admin", "Admin"
		MEMBER = "member", "Member"
		VIEWER = "viewer", "Viewer"

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
	notification = models.OneToOneField(
		"notifications.Notification",
		on_delete=models.SET_NULL,
		related_name="workspace_invitation",
		null=True,
		blank=True,
	)
	created_at = models.DateTimeField(default=timezone.now)
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
