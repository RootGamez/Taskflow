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


class SprintBoardApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        response = self.client.post(
            "/api/v1/auth/login/", {"email": "owner@example.com", "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.user, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        self.todo = self.workspace.statuses.get(order=1)
        self.done = self.workspace.statuses.get(is_done=True)

        self.project_a = Project.objects.create(workspace=self.workspace, name="Alpha", key="ALP")
        self.col_a_todo = ProjectColumn.objects.create(
            project=self.project_a, name="Backlog", order=1, workspace_status=self.todo
        )
        self.col_a_done = ProjectColumn.objects.create(
            project=self.project_a, name="Hecho", order=2, workspace_status=self.done
        )
        self.project_b = Project.objects.create(workspace=self.workspace, name="Beta", key="BET")
        self.col_b_todo = ProjectColumn.objects.create(
            project=self.project_b, name="Backlog", order=1, workspace_status=self.todo
        )

        self.sprint = Sprint.objects.create(
            workspace=self.workspace, name="S1", start_date=date(2026, 1, 1), end_date=date(2026, 1, 14)
        )

        self.t_a = Ticket.objects.create(
            project=self.project_a, column=self.col_a_todo, created_by=self.user, title="A ticket"
        )
        self.t_a.sprints.add(self.sprint)
        self.t_b = Ticket.objects.create(
            project=self.project_b, column=self.col_b_todo, created_by=self.user, title="B ticket"
        )
        self.t_b.sprints.add(self.sprint)
        self.t_backlog = Ticket.objects.create(
            project=self.project_a, column=self.col_a_todo, created_by=self.user, title="Sin sprint"
        )

    def _board(self, query: str = "") -> object:
        return self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/board/{query}")

    def test_board_returns_tickets_across_projects_for_a_sprint(self) -> None:
        response = self._board(f"?sprint={self.sprint.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {t["title"] for t in response.data["tickets"]}
        self.assertEqual(titles, {"A ticket", "B ticket"})
        projects = {t["project"]["name"] for t in response.data["tickets"]}
        self.assertEqual(projects, {"Alpha", "Beta"})
        self.assertEqual(len(response.data["statuses"]), 3)

    def test_board_backlog_filter_returns_ticketless_sprints(self) -> None:
        response = self._board("?sprint=backlog")

        titles = {t["title"] for t in response.data["tickets"]}
        self.assertEqual(titles, {"Sin sprint"})

    def test_board_tickets_carry_workspace_status_id(self) -> None:
        response = self._board(f"?sprint={self.sprint.id}")

        for ticket in response.data["tickets"]:
            self.assertEqual(ticket["workspace_status_id"], str(self.todo.id))

    def test_board_requires_membership(self) -> None:
        User.objects.create_user(email="x@example.com", full_name="X", password="Passw0rd!123")
        login = self.client.post(
            "/api/v1/auth/login/", {"email": "x@example.com", "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        self.assertEqual(self._board().status_code, status.HTTP_404_NOT_FOUND)


class TicketWorkspaceStatusPatchTests(SprintBoardApiTests):
    def test_patch_workspace_status_moves_ticket_to_mapped_column(self) -> None:
        response = self.client.patch(
            f"/api/v1/projects/{self.project_a.id}/tickets/{self.t_a.id}/",
            {"workspace_status_id": str(self.done.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.t_a.refresh_from_db()
        self.assertEqual(self.t_a.column_id, self.col_a_done.id)

    def test_patch_workspace_status_without_mapped_column_returns_400(self) -> None:
        # project_b no tiene columna mapeada al estado "Hecho".
        response = self.client.patch(
            f"/api/v1/projects/{self.project_b.id}/tickets/{self.t_b.id}/",
            {"workspace_status_id": str(self.done.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
