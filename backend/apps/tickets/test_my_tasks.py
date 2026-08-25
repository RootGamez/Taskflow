from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class MyTasksRouteTests(APITestCase):
    """`tickets/mine/` no debe colisionar con `tickets/<uuid:ticket_id>/`."""

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
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

    def test_tickets_mine_returns_empty_list_stub(self) -> None:
        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_tickets_mine_does_not_collide_with_ticket_single_view(self) -> None:
        ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.user,
            title="Ticket real",
            order=1,
        )

        mine_response = self.client.get("/api/v1/tickets/mine/")
        single_response = self.client.get(f"/api/v1/tickets/{ticket.id}/")

        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mine_response.data, [])
        self.assertEqual(single_response.status_code, status.HTTP_200_OK)
        self.assertEqual(single_response.data["id"], str(ticket.id))

    def test_tickets_mine_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
