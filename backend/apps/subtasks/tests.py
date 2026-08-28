from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.subtasks.models import SubTask
from apps.subtasks.views import MAX_SUBTASKS_PER_TICKET
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class SubTaskFlowTests(APITestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@example.com", full_name="Outsider", password="Passw0rd!123"
        )

        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.viewer, role=WorkspaceMember.Role.VIEWER, is_active=True
        )

        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Arreglar login",
            order=1,
        )

        # Ticket de otro proyecto, mismo workspace (RB3).
        self.foreign_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")
        self.foreign_column = ProjectColumn.objects.create(
            project=self.foreign_project, name="Backlog", order=1
        )
        self.foreign_ticket = Ticket.objects.create(
            project=self.foreign_project,
            column=self.foreign_column,
            created_by=self.owner,
            title="Ticket de otro proyecto",
            order=1,
        )

        # Workspace ajeno por completo, para el caso 404 de "workspace del que
        # no soy miembro".
        self.other_workspace = Workspace.objects.create(name="Otro workspace", owner=self.outsider)
        WorkspaceMember.objects.create(
            workspace=self.other_workspace,
            user=self.outsider,
            role=WorkspaceMember.Role.OWNER,
            is_active=True,
        )

    def _login(self, email: str) -> None:
        response = self.client.post(
            "/api/v1/auth/login/", {"email": email, "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def _subtasks_url(self, project=None, ticket=None) -> str:
        project = project or self.project
        ticket = ticket or self.ticket
        return f"/api/v1/projects/{project.id}/tickets/{ticket.id}/subtasks/"

    def _subtask_detail_url(self, subtask_id, project=None, ticket=None) -> str:
        project = project or self.project
        ticket = ticket or self.ticket
        return f"/api/v1/projects/{project.id}/tickets/{ticket.id}/subtasks/{subtask_id}/"

    def _create_subtask(self, title: str = "Subtarea", **extra) -> dict:
        self._login(self.owner.email)
        response = self.client.post(self._subtasks_url(), {"title": title, **extra}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    # -- Listado ----------------------------------------------------------

    def test_list_subtasks_returns_only_that_ticket_subtasks(self) -> None:
        SubTask.objects.create(ticket=self.ticket, title="De este ticket", order=1)
        SubTask.objects.create(ticket=self.foreign_ticket, title="De otro ticket", order=1)

        self._login(self.owner.email)
        response = self.client.get(self._subtasks_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "De este ticket")

    def test_list_subtasks_is_ordered_by_order_then_created_at(self) -> None:
        third = SubTask.objects.create(ticket=self.ticket, title="Tercera", order=3)
        first = SubTask.objects.create(ticket=self.ticket, title="Primera", order=1)
        second = SubTask.objects.create(ticket=self.ticket, title="Segunda", order=2)

        self._login(self.owner.email)
        response = self.client.get(self._subtasks_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.data]
        self.assertEqual(ids, [str(first.id), str(second.id), str(third.id)])

    def test_list_subtasks_requires_authentication(self) -> None:
        response = self.client.get(self._subtasks_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_subtasks_from_a_foreign_workspace_returns_404(self) -> None:
        self._login(self.outsider.email)
        response = self.client.get(self._subtasks_url())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_subtasks_of_a_ticket_from_another_project_returns_404(self) -> None:
        self._login(self.owner.email)
        response = self.client.get(self._subtasks_url(ticket=self.foreign_ticket, project=self.project))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -- Creacion -----------------------------------------------------------

    def test_create_subtask_returns_201_with_order_max_plus_one(self) -> None:
        SubTask.objects.create(ticket=self.ticket, title="Existente", order=5)

        data = self._create_subtask("Nueva subtarea")

        self.assertEqual(data["order"], 6)
        self.assertEqual(data["title"], "Nueva subtarea")
        self.assertFalse(data["is_done"])
        self.assertIsNone(data["completed_at"])
        self.assertIsNone(data["assignee"])
        self.assertEqual(data["ticket_id"], str(self.ticket.id))

    def test_create_subtask_with_blank_title_returns_400(self) -> None:
        self._login(self.owner.email)
        response = self.client.post(self._subtasks_url(), {"title": "   "}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_create_subtask_as_viewer_returns_403(self) -> None:
        self._login(self.viewer.email)
        response = self.client.post(self._subtasks_url(), {"title": "Subtarea"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creating_the_101st_subtask_returns_400(self) -> None:
        SubTask.objects.bulk_create(
            [
                SubTask(ticket=self.ticket, title=f"Subtarea {i}", order=i + 1)
                for i in range(MAX_SUBTASKS_PER_TICKET)
            ]
        )

        self._login(self.owner.email)
        response = self.client.post(self._subtasks_url(), {"title": "La 101"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    # -- Actualizacion --------------------------------------------------

    def test_patch_subtask_marks_it_done_and_sets_completed_at(self) -> None:
        data = self._create_subtask("Marcar como hecha")

        self._login(self.owner.email)
        response = self.client.patch(
            self._subtask_detail_url(data["id"]), {"is_done": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_done"])
        self.assertIsNotNone(response.data["completed_at"])

    def test_patch_subtask_updates_the_title(self) -> None:
        data = self._create_subtask("Titulo viejo")

        self._login(self.owner.email)
        response = self.client.patch(
            self._subtask_detail_url(data["id"]), {"title": "Titulo nuevo"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Titulo nuevo")

    def test_patch_subtask_from_another_ticket_returns_404(self) -> None:
        data = self._create_subtask("De este ticket")

        self._login(self.owner.email)
        response = self.client.patch(
            self._subtask_detail_url(data["id"], ticket=self.foreign_ticket),
            {"title": "No deberia aplicar"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_subtask_as_viewer_returns_403(self) -> None:
        data = self._create_subtask("Subtarea")

        self._login(self.viewer.email)
        response = self.client.patch(
            self._subtask_detail_url(data["id"]), {"is_done": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -- Borrado ----------------------------------------------------------

    def test_delete_subtask_returns_204(self) -> None:
        data = self._create_subtask("Para borrar")

        self._login(self.owner.email)
        response = self.client.delete(self._subtask_detail_url(data["id"]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SubTask.objects.filter(id=data["id"]).exists())

    def test_delete_subtask_does_not_delete_the_ticket(self) -> None:
        data = self._create_subtask("Para borrar")

        self._login(self.owner.email)
        response = self.client.delete(self._subtask_detail_url(data["id"]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Ticket.objects.filter(id=self.ticket.id).exists())

    def test_deleting_the_ticket_deletes_its_subtasks(self) -> None:
        data = self._create_subtask("Sobrevive")
        subtask_id = data["id"]

        self._login(self.owner.email)
        response = self.client.delete(f"/api/v1/projects/{self.project.id}/tickets/{self.ticket.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SubTask.objects.filter(id=subtask_id).exists())

    def test_deleting_the_ticket_still_returns_204_and_reorders_siblings(self) -> None:
        self._create_subtask("Con subtareas")
        second_ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Segundo ticket",
            order=2,
        )

        self._login(self.owner.email)
        response = self.client.delete(f"/api/v1/projects/{self.project.id}/tickets/{self.ticket.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        second_ticket.refresh_from_db()
        self.assertEqual(second_ticket.order, 1)

    def test_deleting_the_assignee_user_keeps_the_subtask(self) -> None:
        member = User.objects.create_user(
            email="member@example.com", full_name="Member", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=member, role=WorkspaceMember.Role.MEMBER, is_active=True
        )
        data = self._create_subtask("Con responsable", assignee_id=str(member.id))

        member.delete()

        subtask = SubTask.objects.get(id=data["id"])
        self.assertIsNone(subtask.assignee_id)

    # -- Integracion con WP-0 (contadores en el payload del ticket) -----

    def test_subtask_counts_are_reflected_in_the_ticket_payload(self) -> None:
        first = self._create_subtask("Uno")
        self._create_subtask("Dos")

        self._login(self.owner.email)
        self.client.patch(self._subtask_detail_url(first["id"]), {"is_done": True}, format="json")

        response = self.client.get(f"/api/v1/projects/{self.project.id}/tickets/")

        ticket_payload = next(row for row in response.data if row["id"] == str(self.ticket.id))
        self.assertEqual(ticket_payload["subtask_count"], 2)
        self.assertEqual(ticket_payload["completed_subtask_count"], 1)
