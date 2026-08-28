from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class ProjectFlowTests(APITestCase):
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

		self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)

	def test_create_project_creates_default_columns(self) -> None:
		response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/projects/",
			{"name": "Core Platform", "description": "Implementacion inicial"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["name"], "Core Platform")
		self.assertEqual(len(response.data["columns"]), 3)
		self.assertEqual([column["name"] for column in response.data["columns"]], ["Backlog", "En progreso", "Hecho"])

	def test_cannot_delete_last_column_in_project(self) -> None:
		create_project = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/projects/",
			{"name": "Core Platform"},
			format="json",
		)
		project_id = create_project.data["id"]

		columns_response = self.client.get(f"/api/v1/projects/{project_id}/columns/")
		columns = columns_response.data

		for column in columns[1:]:
			delete_response = self.client.delete(f"/api/v1/projects/{project_id}/columns/{column['id']}/")
			self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

		last_column_delete = self.client.delete(f"/api/v1/projects/{project_id}/columns/{columns[0]['id']}/")
		self.assertEqual(last_column_delete.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(str(last_column_delete.data["detail"]), "El proyecto debe tener al menos una columna.")

	def test_viewer_cannot_create_project(self) -> None:
		viewer = User.objects.create_user(
			email="viewer@example.com",
			full_name="Viewer",
			password="Passw0rd!123",
		)
		workspace = Workspace.objects.create(name="Viewer Workspace", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=viewer,
			role=WorkspaceMember.Role.VIEWER,
			is_active=True,
		)

		viewer_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": "viewer@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {viewer_login.data['access']}")

		response = self.client.post(
			f"/api/v1/workspaces/{workspace.slug}/projects/",
			{"name": "No permitido"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_admin_can_create_project(self) -> None:
		admin = User.objects.create_user(
			email="admin@example.com",
			full_name="Admin",
			password="Passw0rd!123",
		)
		workspace = Workspace.objects.create(name="Admin Workspace", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=workspace,
			user=admin,
			role=WorkspaceMember.Role.ADMIN,
			is_active=True,
		)

		admin_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": "admin@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_login.data['access']}")

		response = self.client.post(
			f"/api/v1/workspaces/{workspace.slug}/projects/",
			{"name": "Permitido"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)

	# --- T-4 (opcional, docs/PHASE_4_PLAN.md D23/RT-11, seccion 5.5 tests
	# 31-34): `columns` opcional en `ProjectCreateSerializer`. ---

	def test_creating_a_project_without_columns_uses_the_defaults(self) -> None:
		# RT-11: primer test de este paso -- un POST sin `columns` (el 100%
		# del trafico de hoy) tiene que seguir creando EXACTAMENTE
		# `DEFAULT_PROJECT_COLUMNS`.
		response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/projects/",
			{"name": "Sin columnas custom"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(
			[(column["name"], column["color"]) for column in response.data["columns"]],
			[("Backlog", "#64748B"), ("En progreso", "#2563EB"), ("Hecho", "#16A34A")],
		)

	def test_creating_a_project_with_custom_columns_uses_them_in_order(self) -> None:
		response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/projects/",
			{
				"name": "Con columnas custom",
				"columns": [
					{"name": "Por hacer", "color": "#111111"},
					{"name": "Haciendo"},
					{"name": "Listo", "color": "#22C55E"},
				],
			},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		self.assertEqual(
			[column["name"] for column in response.data["columns"]],
			["Por hacer", "Haciendo", "Listo"],
		)
		self.assertEqual([column["order"] for column in response.data["columns"]], [1, 2, 3])
		self.assertEqual(response.data["columns"][0]["color"], "#111111")

	def test_creating_a_project_with_13_columns_returns_400(self) -> None:
		response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/projects/",
			{
				"name": "Demasiadas columnas",
				"columns": [{"name": f"Columna {i}"} for i in range(13)],
			},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_creating_a_project_with_a_blank_column_name_returns_400(self) -> None:
		response = self.client.post(
			f"/api/v1/workspaces/{self.workspace.slug}/projects/",
			{"name": "Columna vacia", "columns": [{"name": "   "}]},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
