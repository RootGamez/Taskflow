from __future__ import annotations

from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.sprints.models import Sprint
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class SprintApiTestCase(APITestCase):
    """Base compartida: owner autenticado + workspace + proyecto + columnas.

    Sigue el patron D8 (APITestCase + login real via /api/v1/auth/login/)
    documentado en el plan tecnico y usado por `apps/tickets/tests.py`.
    """

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self._login("owner@example.com")

        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.user, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.done = ProjectColumn.objects.create(project=self.project, name="Hecho", order=2)

    def _login(self, email: str, password: str = "Passw0rd!123") -> None:
        response = self.client.post(
            "/api/v1/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def _create_sprint(self, project: Project | None = None, **overrides) -> Sprint:
        payload = {
            "project": project or self.project,
            "name": "Sprint 1",
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 1, 14),
        }
        payload.update(overrides)
        return Sprint.objects.create(**payload)

    def _add_viewer(self) -> User:
        viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=viewer, role=WorkspaceMember.Role.VIEWER, is_active=True
        )
        return viewer


class SprintListTests(SprintApiTestCase):
    def test_list_sprints_returns_only_project_sprints(self) -> None:
        own = self._create_sprint(name="Propio")
        other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")
        self._create_sprint(project=other_project, name="Ajeno")

        response = self.client.get(f"/api/v1/projects/{self.project.id}/sprints/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item["id"] for item in response.data]
        self.assertEqual(ids, [str(own.id)])

    def test_list_sprints_includes_ticket_and_completed_counts(self) -> None:
        sprint = self._create_sprint()
        for title, column in [("A", self.backlog), ("B", self.done), ("C", self.done)]:
            ticket = Ticket.objects.create(
                project=self.project, column=column, created_by=self.user, title=title
            )
            ticket.sprints.add(sprint)

        response = self.client.get(f"/api/v1/projects/{self.project.id}/sprints/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data[0]
        self.assertEqual(data["ticket_count"], 3)
        self.assertEqual(data["completed_ticket_count"], 2)

    def test_list_sprints_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get(f"/api/v1/projects/{self.project.id}/sprints/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_sprints_from_foreign_workspace_returns_404(self) -> None:
        stranger = User.objects.create_user(
            email="stranger@example.com", full_name="Stranger", password="Passw0rd!123"
        )
        self._login("stranger@example.com")

        response = self.client.get(f"/api/v1/projects/{self.project.id}/sprints/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SprintCreateTests(SprintApiTestCase):
    def test_create_sprint_returns_201_with_planned_status(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/",
            {"name": "Sprint 12", "start_date": "2026-09-01", "end_date": "2026-09-14", "goal": "Onboarding"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "planned")
        self.assertEqual(response.data["name"], "Sprint 12")
        self.assertEqual(response.data["goal"], "Onboarding")
        self.assertEqual(response.data["ticket_count"], 0)
        self.assertEqual(response.data["completed_ticket_count"], 0)
        self.assertEqual(response.data["project_id"], str(self.project.id))

    def test_create_sprint_ignores_client_supplied_status(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/",
            {
                "name": "Sprint 12",
                "start_date": "2026-09-01",
                "end_date": "2026-09-14",
                "status": "active",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "planned")

    def test_create_sprint_with_end_date_before_start_date_returns_400(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/",
            {"name": "Sprint 12", "start_date": "2026-09-14", "end_date": "2026-09-01"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"], "La fecha de fin no puede ser anterior a la de inicio."
        )

    def test_create_sprint_with_blank_name_returns_400(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/",
            {"name": "", "start_date": "2026-09-01", "end_date": "2026-09-14"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "El nombre del sprint es obligatorio.")

    def test_create_sprint_as_viewer_returns_403(self) -> None:
        self._add_viewer()
        self._login("viewer@example.com")

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/",
            {"name": "Sprint 12", "start_date": "2026-09-01", "end_date": "2026-09-14"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SprintPatchTests(SprintApiTestCase):
    def test_patch_sprint_updates_name_and_goal(self) -> None:
        sprint = self._create_sprint()

        response = self.client.patch(
            f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/",
            {"name": "Sprint renombrado", "goal": "Nueva meta"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Sprint renombrado")
        self.assertEqual(response.data["goal"], "Nueva meta")

    def test_patch_sprint_cannot_change_status(self) -> None:
        sprint = self._create_sprint()

        response = self.client.patch(
            f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/",
            {"status": "active"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "planned")
        sprint.refresh_from_db()
        self.assertEqual(sprint.status, Sprint.Status.PLANNED)

    def test_patch_sprint_from_another_project_returns_404(self) -> None:
        other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")
        sprint = self._create_sprint(project=other_project)

        response = self.client.patch(
            f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/",
            {"name": "Intento"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class SprintActivateCompleteTests(SprintApiTestCase):
    def test_activate_endpoint_sets_status_active_and_completes_previous(self) -> None:
        previous_active = self._create_sprint(name="Sprint activo", status=Sprint.Status.ACTIVE)
        candidate = self._create_sprint(name="Sprint candidato")

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/{candidate.id}/activate/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "active")
        previous_active.refresh_from_db()
        self.assertEqual(previous_active.status, Sprint.Status.COMPLETED)

    def test_complete_endpoint_sets_status_completed(self) -> None:
        sprint = self._create_sprint(status=Sprint.Status.ACTIVE)

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/complete/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "completed")


class SprintDeleteTests(SprintApiTestCase):
    def test_delete_active_sprint_returns_400(self) -> None:
        sprint = self._create_sprint(status=Sprint.Status.ACTIVE)

        response = self.client.delete(f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Finaliza el sprint antes de eliminarlo.")

    def test_delete_planned_sprint_returns_204_and_sends_tickets_to_backlog(self) -> None:
        sprint = self._create_sprint()
        ticket = Ticket.objects.create(
            project=self.project, column=self.backlog, created_by=self.user, title="T"
        )
        ticket.sprints.add(sprint)

        response = self.client.delete(f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        ticket.refresh_from_db()
        self.assertFalse(ticket.sprints.exists())

    def test_delete_sprint_does_not_delete_its_tickets(self) -> None:
        sprint = self._create_sprint()
        ticket = Ticket.objects.create(
            project=self.project, column=self.backlog, created_by=self.user, title="T"
        )
        ticket.sprints.add(sprint)

        response = self.client.delete(f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Ticket.objects.filter(id=ticket.id).exists())

    def test_delete_sprint_as_viewer_returns_403(self) -> None:
        sprint = self._create_sprint()
        self._add_viewer()
        self._login("viewer@example.com")

        response = self.client.delete(f"/api/v1/projects/{self.project.id}/sprints/{sprint.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
