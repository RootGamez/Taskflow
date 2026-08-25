from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.comments.models import Comment
from apps.notifications.models import Notification
from apps.notifications.services import notify_comment_created, notify_ticket_assigned
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketUpdateSerializer
from apps.workspaces.models import Workspace, WorkspaceInvitation, WorkspaceMember

User = get_user_model()


class NotificationInvitationFlowTests(APITestCase):
	def setUp(self) -> None:
		self.owner = User.objects.create_user(
			email="owner@example.com",
			full_name="Owner",
			password="Passw0rd!123",
		)
		self.invited = User.objects.create_user(
			email="invited@example.com",
			full_name="Invited",
			password="Passw0rd!123",
		)
		self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
		WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=self.owner,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)

		owner_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": self.owner.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_login.data['access']}")

		invite_response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/members/",
			{"email": self.invited.email, "role": WorkspaceMember.Role.MEMBER},
			format="json",
		)
		self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)

		self.invitation = WorkspaceInvitation.objects.get(
			workspace=self.workspace,
			invited_user=self.invited,
			status=WorkspaceInvitation.Status.PENDING,
		)
		self.notification = Notification.objects.get(workspace_invitation=self.invitation)

		invited_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": self.invited.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {invited_login.data['access']}")

	def test_user_sees_workspace_invitation_notification(self) -> None:
		response = self.client.get("/api/v1/notifications/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["notification_type"], Notification.Type.WORKSPACE_INVITATION)

	def test_accept_invitation_creates_membership(self) -> None:
		response = self.client.post(
			f"/api/v1/notifications/{self.notification.id}/action/",
			{"action": "accept"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertTrue(
			WorkspaceMember.objects.filter(
				workspace=self.workspace,
				user=self.invited,
				role=WorkspaceMember.Role.MEMBER,
			).exists()
		)

		self.invitation.refresh_from_db()
		self.assertEqual(self.invitation.status, WorkspaceInvitation.Status.ACCEPTED)

	def test_reject_invitation_does_not_create_membership(self) -> None:
		response = self.client.post(
			f"/api/v1/notifications/{self.notification.id}/action/",
			{"action": "reject"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertFalse(
			WorkspaceMember.objects.filter(
				workspace=self.workspace,
				user=self.invited,
			).exists()
		)
		self.invitation.refresh_from_db()
		self.assertEqual(self.invitation.status, WorkspaceInvitation.Status.REJECTED)

	def test_cannot_accept_cancelled_invitation(self) -> None:
		self.client.credentials()
		owner_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": self.owner.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_login.data['access']}")

		cancel_response = self.client.delete(
			f"/api/v1/workspaces/{self.workspace.slug}/invitations/{self.invitation.id}/"
		)
		self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)

		self.client.credentials()
		invited_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": self.invited.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {invited_login.data['access']}")

		response = self.client.post(
			f"/api/v1/notifications/{self.notification.id}/action/",
			{"action": "accept"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(response.data["detail"]), "La invitacion expiro o fue cancelada.")


class NotifyCommentCreatedTests(TestCase):
	"""Cubre `apps.notifications.services.notify_comment_created` (D9)."""

	def setUp(self) -> None:
		self.owner = User.objects.create_user(
			email="owner@example.com", full_name="Owner", password="Passw0rd!123"
		)
		self.assignee = User.objects.create_user(
			email="assignee@example.com", full_name="Assignee", password="Passw0rd!123"
		)
		self.mentioned = User.objects.create_user(
			email="mentioned@example.com", full_name="Mentioned", password="Passw0rd!123"
		)
		self.commenter = User.objects.create_user(
			email="commenter@example.com", full_name="Commenter", password="Passw0rd!123"
		)
		self.ex_member = User.objects.create_user(
			email="ex-member@example.com", full_name="Ex Member", password="Passw0rd!123"
		)

		self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
		for user in (self.owner, self.assignee, self.mentioned, self.commenter):
			WorkspaceMember.objects.create(
				workspace=self.workspace, user=user, role=WorkspaceMember.Role.MEMBER, is_active=True
			)
		# self.ex_member NUNCA es miembro vigente del workspace (o lo fue y
		# se le removió el registro de WorkspaceMember).

		self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
		self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
		self.ticket = Ticket.objects.create(
			project=self.project,
			column=self.column,
			created_by=self.owner,
			title="Arreglar login",
			order=1,
		)
		self.ticket.assignees.set([self.assignee])

		# `commenter` y `ex_member` comentaron antes (ex_member ya no es
		# miembro vigente del workspace al momento del nuevo comentario).
		Comment.objects.create(ticket=self.ticket, author=self.commenter, body="Comentario previo")
		Comment.objects.create(ticket=self.ticket, author=self.ex_member, body="Comentario previo ajeno")

	def test_mentioned_user_receives_only_ticket_mentioned(self) -> None:
		comment = Comment.objects.create(
			ticket=self.ticket, author=self.owner, body=f"Hola @{self.mentioned.full_name}"
		)
		comment.mentions.set([self.mentioned])

		notify_comment_created(comment)

		mentioned_notifications = Notification.objects.filter(recipient=self.mentioned)
		self.assertEqual(mentioned_notifications.count(), 1)
		self.assertEqual(
			mentioned_notifications.first().notification_type, Notification.Type.TICKET_MENTIONED
		)

	def test_comment_without_mention_notifies_creator_assignees_and_previous_commenters(self) -> None:
		comment = Comment.objects.create(ticket=self.ticket, author=self.assignee, body="Sin mencion")

		notify_comment_created(comment)

		commented_recipients = set(
			Notification.objects.filter(notification_type=Notification.Type.TICKET_COMMENTED).values_list(
				"recipient_id", flat=True
			)
		)
		self.assertEqual(commented_recipients, {self.owner.id, self.commenter.id})

	def test_comment_author_is_never_notified(self) -> None:
		comment = Comment.objects.create(ticket=self.ticket, author=self.owner, body="Comento yo mismo")

		notify_comment_created(comment)

		self.assertFalse(Notification.objects.filter(recipient=self.owner).exists())

	def test_mentioned_follower_does_not_also_get_ticket_commented(self) -> None:
		comment = Comment.objects.create(
			ticket=self.ticket, author=self.assignee, body=f"Gracias @{self.owner.full_name}"
		)
		comment.mentions.set([self.owner])

		notify_comment_created(comment)

		owner_notifications = Notification.objects.filter(recipient=self.owner)
		self.assertEqual(owner_notifications.count(), 1)
		self.assertEqual(owner_notifications.first().notification_type, Notification.Type.TICKET_MENTIONED)

	def test_removed_workspace_member_receives_nothing(self) -> None:
		comment = Comment.objects.create(
			ticket=self.ticket, author=self.owner, body=f"Hola @{self.ex_member.full_name}"
		)
		comment.mentions.set([self.ex_member])

		notify_comment_created(comment)

		self.assertFalse(Notification.objects.filter(recipient=self.ex_member).exists())


class NotifyTicketAssignedTests(TestCase):
	"""Cubre `apps.notifications.services.notify_ticket_assigned`."""

	def setUp(self) -> None:
		self.owner = User.objects.create_user(
			email="owner-assign@example.com", full_name="Owner Assign", password="Passw0rd!123"
		)
		self.first_assignee = User.objects.create_user(
			email="first@example.com", full_name="Primera Persona", password="Passw0rd!123"
		)
		self.second_assignee = User.objects.create_user(
			email="second@example.com", full_name="Segunda Persona", password="Passw0rd!123"
		)

		self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
		self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
		self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
		self.ticket = Ticket.objects.create(
			project=self.project,
			column=self.column,
			created_by=self.owner,
			title="Ticket asignable",
			order=1,
		)

	def test_notifies_only_newly_added_assignees(self) -> None:
		notify_ticket_assigned(self.ticket, self.owner, [self.first_assignee.id, self.second_assignee.id])

		recipients = set(
			Notification.objects.filter(notification_type=Notification.Type.TICKET_ASSIGNED).values_list(
				"recipient_id", flat=True
			)
		)
		self.assertEqual(recipients, {self.first_assignee.id, self.second_assignee.id})

	def test_reassigning_same_user_does_not_renotify(self) -> None:
		# `notify_ticket_assigned` recibe solo los IDs *agregados*: si el
		# usuario ya estaba asignado, el caller (el serializer) nunca lo
		# vuelve a pasar en `added_user_ids`. Simulamos ese contrato acá.
		notify_ticket_assigned(self.ticket, self.owner, [self.first_assignee.id])
		notify_ticket_assigned(self.ticket, self.owner, [])

		self.assertEqual(
			Notification.objects.filter(
				recipient=self.first_assignee, notification_type=Notification.Type.TICKET_ASSIGNED
			).count(),
			1,
		)

	def test_self_assignment_does_not_notify_the_actor(self) -> None:
		notify_ticket_assigned(self.ticket, self.owner, [self.owner.id])

		self.assertFalse(
			Notification.objects.filter(
				recipient=self.owner, notification_type=Notification.Type.TICKET_ASSIGNED
			).exists()
		)

	def test_data_contract_includes_ticket_project_and_workspace(self) -> None:
		notify_ticket_assigned(self.ticket, self.owner, [self.first_assignee.id])

		notification = Notification.objects.get(recipient=self.first_assignee)
		self.assertEqual(
			notification.data,
			{
				"ticket_id": str(self.ticket.id),
				"ticket_title": self.ticket.title,
				"project_id": str(self.project.id),
				"workspace_slug": self.workspace.slug,
			},
		)

	def test_update_serializer_derives_added_ids_from_recorded_activities(self) -> None:
		"""Integra con TicketUpdateSerializer: `added_ids` se deriva de los
		`Activity` devueltos por `record_ticket_changes`, sin volver a
		diffear `assignees` con otra query (ver decisión documentada en
		apps/tickets/serializers.py)."""
		serializer = TicketUpdateSerializer(
			self.ticket,
			data={"assignee_ids": [str(self.first_assignee.id), str(self.second_assignee.id)]},
			partial=True,
			context={"project": self.project, "actor": self.owner},
		)
		self.assertTrue(serializer.is_valid(), serializer.errors)
		serializer.save()

		recipients = set(
			Notification.objects.filter(notification_type=Notification.Type.TICKET_ASSIGNED).values_list(
				"recipient_id", flat=True
			)
		)
		self.assertEqual(recipients, {self.first_assignee.id, self.second_assignee.id})
