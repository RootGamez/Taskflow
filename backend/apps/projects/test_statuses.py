from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class WorkspaceStatusApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        login = self.client.post(
            "/api/v1/auth/login/", {"email": "owner@example.com", "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.user, role=WorkspaceMember.Role.OWNER, is_active=True
        )

    def _url(self, suffix: str = "") -> str:
        return f"/api/v1/workspaces/{self.workspace.slug}/statuses/{suffix}"

    def test_workspace_starts_with_three_immutable_default_statuses(self) -> None:
        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [s["name"] for s in response.data]
        self.assertEqual(names, ["Backlog", "En progreso", "Completado"])
        self.assertTrue(response.data[-1]["is_done"])
        self.assertTrue(all(s["is_system"] for s in response.data))

    def test_create_status_appends_at_end(self) -> None:
        response = self.client.post(self._url(), {"name": "En revision"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["order"], 4)
        self.assertFalse(response.data["is_system"])

    def test_system_status_cannot_be_edited_or_deleted(self) -> None:
        system = self.workspace.statuses.get(name="Completado")

        patch_response = self.client.patch(
            self._url(f"{system.id}/"), {"name": "Terminado"}, format="json"
        )
        delete_response = self.client.delete(self._url(f"{system.id}/"))

        self.assertEqual(patch_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(delete_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.workspace.statuses.filter(name="Completado").count(), 1)

    def test_creating_a_status_adds_a_column_to_every_project(self) -> None:
        project_a = Project.objects.create(workspace=self.workspace, name="A")
        project_b = Project.objects.create(workspace=self.workspace, name="B")

        response = self.client.post(self._url(), {"name": "QA"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        for project in (project_a, project_b):
            self.assertTrue(
                project.columns.filter(workspace_status_id=response.data["id"], name="QA").exists()
            )

    def test_deleting_a_custom_status_removes_its_columns(self) -> None:
        project = Project.objects.create(workspace=self.workspace, name="A")
        created = self.client.post(self._url(), {"name": "QA"}, format="json").data

        delete_response = self.client.delete(self._url(f"{created['id']}/"))

        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(project.columns.filter(workspace_status_id=created["id"]).exists())

    def test_project_create_maps_default_columns_to_statuses(self) -> None:
        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/projects/",
            {"name": "Nuevo"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        project = Project.objects.get(id=response.data["id"])
        statuses = list(self.workspace.statuses.order_by("order"))
        columns = list(project.columns.order_by("order"))
        self.assertEqual([c.workspace_status_id for c in columns], [s.id for s in statuses])

    def test_column_patch_can_remap_workspace_status(self) -> None:
        project = Project.objects.create(workspace=self.workspace, name="P")
        column = ProjectColumn.objects.create(project=project, name="C", order=1)
        target = self.workspace.statuses.get(is_done=True)

        response = self.client.patch(
            f"/api/v1/projects/{project.id}/columns/{column.id}/",
            {"workspace_status_id": str(target.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        column.refresh_from_db()
        self.assertEqual(column.workspace_status_id, target.id)
