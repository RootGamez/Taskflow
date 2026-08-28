"""Tests de `GET /api/v1/search/tickets/` (WP-0, Fase 3).

Stub (D del plan tecnico, seccion 3): esta vista todavia no busca nada de
verdad -- `SearchTicketsView` siempre devuelve `[]`. El contrato real
(ranking, scope cross-workspace, seguridad) lo escribe WP-A, que reescribe
este archivo entero conservando estos 3 tests (mismo patron que
`apps/tickets/my_tasks.py` en Fase 2).
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class SearchTicketsStubTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMember.Role.OWNER,
            is_active=True,
        )
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.user,
            title="Ticket buscable",
            order=1,
        )

    def _login(self) -> None:
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "owner@example.com", "password": "Passw0rd!123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def test_requires_authentication(self) -> None:
        response = self.client.get("/api/v1/search/tickets/", {"q": "buscable"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_an_empty_list_for_now(self) -> None:
        self._login()

        response = self.client.get("/api/v1/search/tickets/", {"q": "buscable"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    def test_search_route_does_not_collide_with_ticket_single_view_or_my_tasks(self) -> None:
        self._login()

        # "search/tickets/" no debe resolver contra `tickets/<uuid:ticket_id>/`
        # (TicketSingleView) ni contra `tickets/mine/` (MyTasksView): las 3
        # rutas conviven en apps/tickets/urls.py.
        single_response = self.client.get(f"/api/v1/tickets/{self.ticket.id}/")
        self.assertEqual(single_response.status_code, status.HTTP_200_OK)
        self.assertEqual(single_response.data["id"], str(self.ticket.id))

        mine_response = self.client.get("/api/v1/tickets/mine/")
        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)

        search_response = self.client.get("/api/v1/search/tickets/", {"q": "buscable"})
        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertEqual(search_response.data, [])
