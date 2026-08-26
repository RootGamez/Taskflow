from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.labels.models import Label
from apps.labels.palette import LABEL_COLORS
from apps.projects.models import Project
from apps.tickets.models import Ticket
from apps.projects.models import ProjectColumn
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class LabelApiTestsBase(APITestCase):
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
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")

        self.other_workspace = Workspace.objects.create(name="Otro", owner=self.user)
        self.other_project = Project.objects.create(workspace=self.other_workspace, name="Ajeno")


class LabelListCreateTests(LabelApiTestsBase):
    def test_list_labels_returns_only_project_labels(self) -> None:
        Label.objects.create(project=self.project, name="Bug", color=LABEL_COLORS[0])
        Label.objects.create(project=self.other_project, name="Ajena", color=LABEL_COLORS[1])

        response = self.client.get(f"/api/v1/projects/{self.project.id}/labels/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "Bug")

    def test_list_labels_is_ordered_by_name(self) -> None:
        Label.objects.create(project=self.project, name="Zeta", color=LABEL_COLORS[0])
        Label.objects.create(project=self.project, name="Alfa", color=LABEL_COLORS[1])

        response = self.client.get(f"/api/v1/projects/{self.project.id}/labels/")

        self.assertEqual([label["name"] for label in response.data], ["Alfa", "Zeta"])

    def test_list_labels_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get(f"/api/v1/projects/{self.project.id}/labels/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_labels_from_foreign_workspace_returns_404(self) -> None:
        foreign_project = Project.objects.create(
            workspace=Workspace.objects.create(name="No soy miembro", owner=User.objects.create_user(
                email="otro@example.com", full_name="Otro", password="Passw0rd!123",
            )),
            name="Ajeno de verdad",
        )

        response = self.client.get(f"/api/v1/projects/{foreign_project.id}/labels/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_label_returns_201(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/labels/",
            {"name": "Bug", "color": LABEL_COLORS[0]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Bug")
        self.assertEqual(response.data["color"], LABEL_COLORS[0])
        self.assertEqual(response.data["project_id"], str(self.project.id))

    def test_create_label_with_invalid_color_returns_400(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/labels/",
            {"name": "Bug", "color": "#123456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_create_label_with_duplicate_name_returns_400_not_500(self) -> None:
        Label.objects.create(project=self.project, name="Bug", color=LABEL_COLORS[0])

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/labels/",
            {"name": "bug", "color": LABEL_COLORS[1]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_create_label_as_viewer_returns_403(self) -> None:
        viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123",
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=viewer, role=WorkspaceMember.Role.VIEWER, is_active=True,
        )
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "viewer@example.com", "password": "Passw0rd!123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/labels/",
            {"name": "Bug", "color": LABEL_COLORS[0]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class LabelDetailTests(LabelApiTestsBase):
    def setUp(self) -> None:
        super().setUp()
        self.label = Label.objects.create(project=self.project, name="Bug", color=LABEL_COLORS[0])

    def test_patch_label_updates_name_and_color(self) -> None:
        response = self.client.patch(
            f"/api/v1/projects/{self.project.id}/labels/{self.label.id}/",
            {"name": "Bugfix", "color": LABEL_COLORS[1]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Bugfix")
        self.assertEqual(response.data["color"], LABEL_COLORS[1])

    def test_patch_label_from_another_project_returns_404(self) -> None:
        response = self.client.patch(
            f"/api/v1/projects/{self.other_project.id}/labels/{self.label.id}/",
            {"name": "Bugfix"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_label_returns_204(self) -> None:
        response = self.client.delete(
            f"/api/v1/projects/{self.project.id}/labels/{self.label.id}/",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Label.objects.filter(id=self.label.id).exists())

    def test_delete_label_does_not_delete_its_tickets(self) -> None:
        column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        ticket = Ticket.objects.create(
            project=self.project,
            column=column,
            created_by=self.user,
            title="Ticket con label",
            order=1,
            number=1,
        )
        ticket.labels.set([self.label])

        response = self.client.delete(
            f"/api/v1/projects/{self.project.id}/labels/{self.label.id}/",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Ticket.objects.filter(id=ticket.id).exists())

    def test_delete_label_removes_it_from_ticket_labels(self) -> None:
        column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        ticket = Ticket.objects.create(
            project=self.project,
            column=column,
            created_by=self.user,
            title="Ticket con label",
            order=1,
            number=1,
        )
        ticket.labels.set([self.label])

        self.client.delete(f"/api/v1/projects/{self.project.id}/labels/{self.label.id}/")

        ticket.refresh_from_db()
        self.assertEqual(list(ticket.labels.all()), [])

    def test_delete_label_as_viewer_returns_403(self) -> None:
        viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123",
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=viewer, role=WorkspaceMember.Role.VIEWER, is_active=True,
        )
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "viewer@example.com", "password": "Passw0rd!123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

        response = self.client.delete(
            f"/api/v1/projects/{self.project.id}/labels/{self.label.id}/",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class LabelMigrationTests(APITestCase):
    def test_creating_a_label_does_not_require_a_new_migration(self) -> None:
        # Verificacion de la Seccion 7 del plan: ningun agente introduce
        # cambios de modelo. Ejecuta `makemigrations --check --dry-run`
        # acotado a `labels` dentro del propio test suite para que quede
        # documentado como regresion automatizada, ademas de la verificacion
        # manual del orquestador.
        manage_py = Path(__file__).resolve().parents[2] / "manage.py"
        result = subprocess.run(
            [sys.executable, str(manage_py), "makemigrations", "labels", "--check", "--dry-run"],
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
