from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class WorkspaceFlowTests(APITestCase):
	def setUp(self) -> None:
		self.user = User.objects.create_user(
			email="owner@example.com",
			full_name="Owner",
			password="Passw0rd!123",
		)
		login_response = self.client.post(
			"/api/v1/auth/login/",
			{"email": "owner@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

	def test_create_workspace_and_list_for_user(self) -> None:
		create_response = self.client.post(
			"/api/v1/workspaces/",
			{"name": "Mi Workspace"},
			format="json",
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_response.data["name"], "Mi Workspace")
		self.assertEqual(create_response.data["role"], "owner")
		self.assertTrue(create_response.data["is_active"])

		list_response = self.client.get("/api/v1/workspaces/")
		self.assertEqual(list_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(list_response.data), 1)
		self.assertEqual(list_response.data[0]["name"], "Mi Workspace")

	def test_select_active_workspace(self) -> None:
		workspace_1 = Workspace.objects.create(name="Workspace Uno", owner=self.user)
		workspace_2 = Workspace.objects.create(name="Workspace Dos", owner=self.user)

		member_1 = WorkspaceMember.objects.create(
			workspace=workspace_1,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)
		member_2 = WorkspaceMember.objects.create(
			workspace=workspace_2,
			user=self.user,
			role=WorkspaceMember.Role.ADMIN,
			is_active=False,
		)

		response = self.client.post(
			"/api/v1/workspaces/select-active/",
			{"workspace_id": str(workspace_2.id)},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["id"], str(workspace_2.id))
		self.assertTrue(response.data["is_active"])

		member_1.refresh_from_db()
		member_2.refresh_from_db()
		self.assertFalse(member_1.is_active)
		self.assertTrue(member_2.is_active)

	def test_select_active_workspace_requires_membership(self) -> None:
		outsider = User.objects.create_user(
			email="outsider@example.com",
			full_name="Outsider",
			password="Passw0rd!123",
		)
		private_workspace = Workspace.objects.create(name="Privado", owner=outsider)

		response = self.client.post(
			"/api/v1/workspaces/select-active/",
			{"workspace_id": str(private_workspace.id)},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(response.data["detail"]), "No tienes acceso a este workspace.")

	def test_owner_can_invite_member_with_role(self) -> None:
		workspace = Workspace.objects.create(name="Equipo", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)
		invited = User.objects.create_user(
			email="nuevo@example.com",
			full_name="Nuevo Usuario",
			password="Passw0rd!123",
		)

		response = self.client.post(
			f"/api/v1/workspaces/{workspace.slug}/members/",
			{"email": invited.email, "role": WorkspaceMember.Role.VIEWER},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["invited_user_email"], invited.email)
		self.assertEqual(response.data["status"], "pending")
		self.assertEqual(response.data["role"], WorkspaceMember.Role.VIEWER)
		self.assertFalse(WorkspaceMember.objects.filter(workspace=workspace, user=invited).exists())
		self.assertTrue(Notification.objects.filter(recipient=invited).exists())

	def test_admin_can_update_member_role(self) -> None:
		owner = self.user
		workspace = Workspace.objects.create(name="Producto", owner=owner)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=owner,
			role=WorkspaceMember.Role.OWNER,
			is_active=False,
		)

		admin = User.objects.create_user(
			email="admin@example.com",
			full_name="Admin",
			password="Passw0rd!123",
		)
		target = User.objects.create_user(
			email="target@example.com",
			full_name="Target",
			password="Passw0rd!123",
		)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=admin,
			role=WorkspaceMember.Role.ADMIN,
			is_active=True,
		)
		target_membership = WorkspaceMember.objects.create(
			workspace=workspace,
			user=target,
			role=WorkspaceMember.Role.VIEWER,
			is_active=False,
		)

		admin_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": admin.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_login.data['access']}")

		response = self.client.patch(
			f"/api/v1/workspaces/{workspace.slug}/members/{target_membership.id}/",
			{"role": WorkspaceMember.Role.MEMBER},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["role"], WorkspaceMember.Role.MEMBER)

	def test_member_cannot_invite_people(self) -> None:
		owner = self.user
		workspace = Workspace.objects.create(name="Producto", owner=owner)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=owner,
			role=WorkspaceMember.Role.OWNER,
			is_active=False,
		)

		member = User.objects.create_user(
			email="member@example.com",
			full_name="Member",
			password="Passw0rd!123",
		)
		invited = User.objects.create_user(
			email="invitado@example.com",
			full_name="Invitado",
			password="Passw0rd!123",
		)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=member,
			role=WorkspaceMember.Role.MEMBER,
			is_active=True,
		)

		member_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": member.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {member_login.data['access']}")

		response = self.client.post(
			f"/api/v1/workspaces/{workspace.slug}/members/",
			{"email": invited.email, "role": WorkspaceMember.Role.VIEWER},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_owner_can_list_and_cancel_pending_invitation(self) -> None:
		workspace = Workspace.objects.create(name="Equipo", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)
		invited = User.objects.create_user(
			email="pendiente@example.com",
			full_name="Pendiente",
			password="Passw0rd!123",
		)

		invite_response = self.client.post(
			f"/api/v1/workspaces/{workspace.slug}/members/",
			{"email": invited.email, "role": WorkspaceMember.Role.MEMBER},
			format="json",
		)
		self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)
		invitation_id = invite_response.data["id"]

		list_response = self.client.get(f"/api/v1/workspaces/{workspace.slug}/invitations/")
		self.assertEqual(list_response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(list_response.data), 1)
		self.assertEqual(list_response.data[0]["status"], "pending")

		cancel_response = self.client.delete(
			f"/api/v1/workspaces/{workspace.slug}/invitations/{invitation_id}/"
		)
		self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
		self.assertEqual(cancel_response.data["status"], "cancelled")
