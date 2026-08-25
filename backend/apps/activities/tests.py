from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Activity
from apps.activities.services import record_ticket_created
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketUpdateSerializer
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class TicketActivityListViewTests(APITestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project, column=self.backlog, created_by=self.owner, title="Ticket base", order=1
        )

        login_response = self.client.post(
            "/api/v1/auth/login/", {"email": self.owner.email, "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def _list_url(self) -> str:
        return f"/api/v1/projects/{self.project.id}/tickets/{self.ticket.id}/activities/"

    def test_member_can_list_activities_in_descending_order(self) -> None:
        first = Activity.objects.create(ticket=self.ticket, actor=self.owner, action=Activity.Action.CREATED)
        second = Activity.objects.create(
            ticket=self.ticket,
            actor=self.owner,
            action=Activity.Action.TITLE_CHANGED,
            from_value={"id": None, "label": "Ticket base"},
            to_value={"id": None, "label": "Ticket renombrado"},
        )

        response = self.client.get(self._list_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]["id"], str(second.id))
        self.assertEqual(response.data[1]["id"], str(first.id))
        self.assertEqual(response.data[0]["actor"]["full_name"], "Owner")

    def test_user_outside_workspace_gets_404(self) -> None:
        Activity.objects.create(ticket=self.ticket, actor=self.owner, action=Activity.Action.CREATED)
        stranger = User.objects.create_user(
            email="stranger@example.com", full_name="Stranger", password="Passw0rd!123"
        )
        stranger_login = self.client.post(
            "/api/v1/auth/login/", {"email": stranger.email, "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {stranger_login.data['access']}")

        response = self.client.get(self._list_url())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_listing_does_not_scale_queries_with_activity_count(self) -> None:
        record_ticket_created(self.ticket, self.owner)

        with self.assertNumQueries(5):
            first_response = self.client.get(self._list_url())
        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first_response.data), 1)

        for index in range(15):
            Activity.objects.create(
                ticket=self.ticket,
                actor=self.owner,
                action=Activity.Action.TITLE_CHANGED,
                from_value={"id": None, "label": f"v{index}"},
                to_value={"id": None, "label": f"v{index + 1}"},
            )

        with self.assertNumQueries(5):
            second_response = self.client.get(self._list_url())
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second_response.data), 16)


class TicketUpdateSerializerActivityIntegrationTests(APITestCase):
    """Protege el hallazgo de la Fase 0: los dos call sites de update
    (`TicketDetailView.patch` y `TicketConsumer._patch_ticket`) comparten
    `TicketUpdateSerializer`, así que instanciarlo directo con
    `context={"actor": ...}` (sin pasar por HTTP) simula fielmente lo que
    hace el consumer de WebSocket — que es exactamente el mismo call site
    real, no un mock.
    """

    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.progress = ProjectColumn.objects.create(project=self.project, name="En progreso", order=2)
        self.ticket = Ticket.objects.create(
            project=self.project, column=self.backlog, created_by=self.owner, title="Ticket base", order=1
        )

    def test_patch_via_consumer_style_context_generates_activity(self) -> None:
        # Mismo patrón que `TicketConsumer._patch_ticket`: se instancia el
        # serializer directo, con `context={"project": ..., "actor": ...}`
        # (nunca pasa por `request`, a diferencia del call site HTTP).
        ticket = Ticket.objects.select_related("column").get(id=self.ticket.id)
        serializer = TicketUpdateSerializer(
            ticket,
            data={"column_id": str(self.progress.id), "order": 1},
            partial=True,
            context={"project": self.project, "actor": self.owner},
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()

        activity = Activity.objects.get(ticket=self.ticket, action=Activity.Action.STATUS_CHANGED)
        self.assertEqual(activity.actor_id, self.owner.id)
        self.assertEqual(activity.to_value, {"id": str(self.progress.id), "label": "En progreso"})
