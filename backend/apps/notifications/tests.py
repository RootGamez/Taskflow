from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
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
