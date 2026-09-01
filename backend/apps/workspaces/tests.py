from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.notifications.models import Notification
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
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

	def test_owner_can_update_workspace_settings(self) -> None:
		workspace = Workspace.objects.create(name="Original", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)

		response = self.client.patch(
			f"/api/v1/workspaces/{workspace.slug}/",
			{"name": "Nuevo Nombre", "slug": "nuevo-slug"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["name"], "Nuevo Nombre")
		self.assertEqual(response.data["slug"], "nuevo-slug")

	def test_admin_can_update_workspace_settings(self) -> None:
		owner = self.user
		workspace = Workspace.objects.create(name="Equipo", owner=owner)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=owner,
			role=WorkspaceMember.Role.OWNER,
			is_active=False,
		)

		admin = User.objects.create_user(
			email="admin-settings@example.com",
			full_name="Admin Settings",
			password="Passw0rd!123",
		)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=admin,
			role=WorkspaceMember.Role.ADMIN,
			is_active=True,
		)

		admin_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": admin.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_login.data['access']}")

		response = self.client.patch(
			f"/api/v1/workspaces/{workspace.slug}/",
			{"name": "Equipo Admin"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["name"], "Equipo Admin")

	def test_member_cannot_delete_workspace(self) -> None:
		owner = self.user
		workspace = Workspace.objects.create(name="Eliminar", owner=owner)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=owner,
			role=WorkspaceMember.Role.OWNER,
			is_active=False,
		)

		member = User.objects.create_user(
			email="member-delete@example.com",
			full_name="Member Delete",
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

		response = self.client.delete(f"/api/v1/workspaces/{workspace.slug}/")
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_owner_can_delete_workspace(self) -> None:
		workspace = Workspace.objects.create(name="Borrar", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)

		response = self.client.delete(f"/api/v1/workspaces/{workspace.slug}/")
		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(Workspace.objects.filter(id=workspace.id).exists())


class WorkspaceMemberRemovalTests(APITestCase):
	def setUp(self) -> None:
		self.owner = User.objects.create_user(
			email="owner-remove@example.com",
			full_name="Owner Remove",
			password="Passw0rd!123",
		)
		self.admin = User.objects.create_user(
			email="admin-remove@example.com",
			full_name="Admin Remove",
			password="Passw0rd!123",
		)
		self.member = User.objects.create_user(
			email="member-remove@example.com",
			full_name="Member Remove",
			password="Passw0rd!123",
		)

		self.workspace = Workspace.objects.create(name="Equipo Remove", owner=self.owner)
		self.owner_membership = WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=self.owner,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)
		self.admin_membership = WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=self.admin,
			role=WorkspaceMember.Role.ADMIN,
			is_active=True,
		)
		self.member_membership = WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=self.member,
			role=WorkspaceMember.Role.MEMBER,
			is_active=True,
		)

		self.login_as(self.owner)

	def login_as(self, user) -> None:
		response = self.client.post(
			"/api/v1/auth/login/",
			{"email": user.email, "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

	def member_url(self, membership: WorkspaceMember) -> str:
		return f"/api/v1/workspaces/{self.workspace.slug}/members/{membership.id}/"

	def test_owner_can_remove_member(self) -> None:
		response = self.client.delete(self.member_url(self.member_membership))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["role"], WorkspaceMember.Role.REMOVED)
		# Soft-delete: la fila sigue existiendo (para no perder el historial
		# ni la seccion "Miembros eliminados"), solo que `objects` (el
		# manager por defecto) la oculta.
		self.assertFalse(WorkspaceMember.objects.filter(id=self.member_membership.id).exists())
		self.assertTrue(WorkspaceMember.all_objects.filter(id=self.member_membership.id).exists())
		removed = WorkspaceMember.all_objects.get(id=self.member_membership.id)
		self.assertEqual(removed.role, WorkspaceMember.Role.REMOVED)
		self.assertFalse(removed.is_active)

	def test_removing_member_notifies_the_removed_user(self) -> None:
		self.client.delete(self.member_url(self.member_membership))

		notification = Notification.objects.filter(
			recipient=self.member,
			notification_type=Notification.Type.WORKSPACE_MEMBER_REMOVED,
		).first()
		self.assertIsNotNone(notification)
		self.assertEqual(notification.actor_id, self.owner.id)
		self.assertEqual(notification.data["workspace_slug"], self.workspace.slug)

	def test_removing_member_keeps_ticket_assignments_intact(self) -> None:
		project = Project.objects.create(workspace=self.workspace, name="Core")
		column = ProjectColumn.objects.create(project=project, name="Backlog", order=1)
		ticket = Ticket.objects.create(project=project, column=column, title="Tarea", order=1)
		ticket.assignees.add(self.member, self.admin)

		response = self.client.delete(self.member_url(self.member_membership))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		# Ningun ticket queda huerfano: el M2M de assignees es a User, no a
		# WorkspaceMember, asi que expulsar del espacio no lo toca.
		self.assertIn(self.member, ticket.assignees.all())
		self.assertIn(self.admin, ticket.assignees.all())

	def test_removed_member_loses_access_to_the_workspace(self) -> None:
		project = Project.objects.create(workspace=self.workspace, name="Core")
		column = ProjectColumn.objects.create(project=project, name="Backlog", order=1)
		ticket = Ticket.objects.create(project=project, column=column, title="Tarea", order=1)

		self.client.delete(self.member_url(self.member_membership))
		self.login_as(self.member)

		# Ya no ve el workspace en su listado...
		workspaces_response = self.client.get("/api/v1/workspaces/")
		self.assertEqual(
			[w["id"] for w in workspaces_response.data],
			[],
		)
		# ...ni puede abrir sus tickets...
		ticket_response = self.client.get(f"/api/v1/tickets/{ticket.id}/")
		self.assertEqual(ticket_response.status_code, status.HTTP_404_NOT_FOUND)
		# ...ni volver a intentar la gestion de miembros del espacio...
		members_response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/members/")
		self.assertEqual(members_response.status_code, status.HTTP_404_NOT_FOUND)
		# ...ni al proyecto en si: `get_project_for_user` (WorkspaceRoleAccessMixin)
		# es el chequeo compartido por ~10 apps (columnas, subtareas,
		# adjuntos, comentarios, relaciones, etc.) y atraviesa `memberships`
		# con un JOIN que no pasa por el manager de WorkspaceMember -- ver el
		# comentario en access.py.
		columns_response = self.client.get(f"/api/v1/projects/{project.id}/columns/")
		self.assertEqual(columns_response.status_code, status.HTTP_404_NOT_FOUND)

	def test_members_list_includes_removed_members_for_current_members(self) -> None:
		self.client.delete(self.member_url(self.member_membership))

		response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/members/")

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		by_id = {item["id"]: item for item in response.data}
		self.assertIn(str(self.member_membership.id), by_id)
		self.assertEqual(by_id[str(self.member_membership.id)]["role"], WorkspaceMember.Role.REMOVED)
		self.assertEqual(by_id[str(self.owner_membership.id)]["role"], WorkspaceMember.Role.OWNER)

	def test_reinviting_a_removed_member_reactivates_as_the_new_invited_role(self) -> None:
		self.client.delete(self.member_url(self.member_membership))

		invite_response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/members/",
			{"email": self.member.email, "role": WorkspaceMember.Role.MEMBER},
			format="json",
		)
		self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)

		notification = Notification.objects.get(
			recipient=self.member,
			notification_type=Notification.Type.WORKSPACE_INVITATION,
		)
		self.login_as(self.member)
		accept_response = self.client.post(
			f"/api/v1/notifications/{notification.id}/action/",
			{"action": "accept"},
			format="json",
		)

		self.assertEqual(accept_response.status_code, status.HTTP_200_OK)
		# Misma fila (mismo id de membresia), reactivada -- no un duplicado.
		reactivated = WorkspaceMember.objects.get(id=self.member_membership.id)
		self.assertEqual(reactivated.role, WorkspaceMember.Role.MEMBER)

		workspaces_response = self.client.get("/api/v1/workspaces/")
		self.assertIn(
			self.workspace.slug,
			[w["slug"] for w in workspaces_response.data],
		)

	def test_cannot_remove_the_owner(self) -> None:
		self.login_as(self.admin)

		response = self.client.delete(self.member_url(self.owner_membership))

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(
			WorkspaceMember.objects.get(id=self.owner_membership.id).role,
			WorkspaceMember.Role.OWNER,
		)

	def test_cannot_remove_yourself(self) -> None:
		self.login_as(self.admin)

		response = self.client.delete(self.member_url(self.admin_membership))

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(
			WorkspaceMember.objects.get(id=self.admin_membership.id).role,
			WorkspaceMember.Role.ADMIN,
		)

	def test_admin_cannot_remove_another_admin(self) -> None:
		other_admin = User.objects.create_user(
			email="admin2-remove@example.com",
			full_name="Admin Dos",
			password="Passw0rd!123",
		)
		other_admin_membership = WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=other_admin,
			role=WorkspaceMember.Role.ADMIN,
			is_active=False,
		)
		self.login_as(self.admin)

		response = self.client.delete(self.member_url(other_admin_membership))

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(
			WorkspaceMember.objects.get(id=other_admin_membership.id).role,
			WorkspaceMember.Role.ADMIN,
		)

	def test_owner_can_remove_an_admin(self) -> None:
		response = self.client.delete(self.member_url(self.admin_membership))

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(
			WorkspaceMember.all_objects.get(id=self.admin_membership.id).role,
			WorkspaceMember.Role.REMOVED,
		)

	def test_member_cannot_remove_other_members(self) -> None:
		self.login_as(self.member)

		response = self.client.delete(self.member_url(self.admin_membership))

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(
			WorkspaceMember.objects.get(id=self.admin_membership.id).role,
			WorkspaceMember.Role.ADMIN,
		)

	def test_member_from_another_workspace_is_not_found(self) -> None:
		foreign_workspace = Workspace.objects.create(name="Ajeno", owner=self.admin)
		foreign_membership = WorkspaceMember.objects.create(
			workspace=foreign_workspace,
			user=self.admin,
			role=WorkspaceMember.Role.OWNER,
			is_active=False,
		)

		response = self.client.delete(self.member_url(foreign_membership))

		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
		self.assertEqual(
			WorkspaceMember.objects.get(id=foreign_membership.id).role,
			WorkspaceMember.Role.OWNER,
		)
