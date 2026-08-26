"""Tests de `GET /api/v1/tickets/mine/` (ver docs/PHASE_2_REMAINING_PLAN.md, seccion 5).

Reescritura completa del stub de Fase 0. Conserva la logica de los 2 tests
que ya pasaban contra el stub (auth requerida, no colision de rutas) y
agrega la cobertura real: scope cross-workspace (D28), anti-N+1 (D30),
exclusion de proyectos archivados (D31), orden por proyecto/fecha (D32) y
el limite duro `MY_TASKS_LIMIT` (D26).
"""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.labels.models import Label
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class MyTasksViewTests(APITestCase):
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
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform", key="CORE")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

    def _login_as(self, email: str, password: str = "Passw0rd!123") -> None:
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": email, "password": password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def _create_ticket(self, project: Project, column: ProjectColumn, **overrides) -> Ticket:
        defaults = {
            "project": project,
            "column": column,
            "created_by": self.user,
            "title": "Ticket base",
            "order": 1,
        }
        defaults.update(overrides)
        return Ticket.objects.create(**defaults)

    # 1. conservar del archivo actual
    def test_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 2. conservar del archivo actual
    def test_does_not_collide_with_ticket_single_view(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Ticket real")

        mine_response = self.client.get("/api/v1/tickets/mine/")
        single_response = self.client.get(f"/api/v1/tickets/{ticket.id}/")

        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)
        self.assertEqual(mine_response.data, [])
        self.assertEqual(single_response.status_code, status.HTTP_200_OK)
        self.assertEqual(single_response.data["id"], str(ticket.id))

    # 3. renombra el _stub
    def test_returns_empty_list_when_user_has_no_assigned_tickets(self) -> None:
        self._create_ticket(self.project, self.column)

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 4. RB1
    def test_returns_empty_list_when_user_has_no_workspace_membership(self) -> None:
        WorkspaceMember.objects.filter(user=self.user).delete()

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 5.
    def test_returns_only_tickets_assigned_to_the_requesting_user(self) -> None:
        other_user = User.objects.create_user(
            email="other@example.com", full_name="Other", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=other_user, role=WorkspaceMember.Role.MEMBER, is_active=True
        )
        my_ticket = self._create_ticket(self.project, self.column, title="Mio")
        my_ticket.assignees.set([self.user])
        other_ticket = self._create_ticket(self.project, self.column, title="De otro")
        other_ticket.assignees.set([other_user])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = [item["title"] for item in response.data]
        self.assertEqual(titles, ["Mio"])

    # 6.
    def test_returns_tickets_across_multiple_projects_and_workspaces(self) -> None:
        other_workspace = Workspace.objects.create(name="Otro espacio", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=other_workspace, user=self.user, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        other_project = Project.objects.create(workspace=other_workspace, name="Growth")
        other_column = ProjectColumn.objects.create(project=other_project, name="Backlog", order=1)

        ticket_a = self._create_ticket(self.project, self.column, title="A")
        ticket_a.assignees.set([self.user])
        ticket_b = self._create_ticket(other_project, other_column, title="B")
        ticket_b.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        titles = {item["title"] for item in response.data}
        self.assertEqual(titles, {"A", "B"})

    # 7. RB5
    def test_excludes_tickets_from_workspaces_where_user_is_not_a_member(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Se va")
        ticket.assignees.set([self.user])

        response_before = self.client.get("/api/v1/tickets/mine/")
        self.assertEqual([item["title"] for item in response_before.data], ["Se va"])

        WorkspaceMember.objects.filter(user=self.user, workspace=self.workspace).delete()

        response_after = self.client.get("/api/v1/tickets/mine/")
        self.assertEqual(response_after.status_code, status.HTTP_200_OK)
        self.assertEqual(response_after.data, [])

    # 8. RB6
    def test_excludes_tickets_from_archived_projects(self) -> None:
        archived_project = Project.objects.create(workspace=self.workspace, name="Legacy", is_archived=True)
        archived_column = ProjectColumn.objects.create(project=archived_project, name="Backlog", order=1)
        ticket = self._create_ticket(archived_project, archived_column, title="Archivado")
        ticket.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 9. RB6 (otra direccion)
    def test_includes_tickets_from_non_archived_projects(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Activo")
        ticket.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["title"] for item in response.data], ["Activo"])

    # 10. RB3
    def test_no_duplicate_tickets_when_user_is_member_and_assignee(self) -> None:
        # self.user ya es OWNER (miembro) del workspace desde setUp Y ademas
        # se lo asigna al ticket -- la query no debe usar un JOIN sobre
        # memberships que duplique la fila (D29).
        ticket = self._create_ticket(self.project, self.column, title="Unico")
        ticket.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    # 11.
    def test_orders_by_project_name_then_due_date_ascending(self) -> None:
        project_b = Project.objects.create(workspace=self.workspace, name="B Project")
        column_b = ProjectColumn.objects.create(project=project_b, name="Backlog", order=1)
        now = timezone.now()

        later = self._create_ticket(self.project, self.column, title="Later", due_date=now + timedelta(days=5))
        earlier = self._create_ticket(self.project, self.column, title="Earlier", due_date=now + timedelta(days=1))
        b_ticket = self._create_ticket(project_b, column_b, title="B ticket", due_date=now + timedelta(days=1))
        for ticket in (later, earlier, b_ticket):
            ticket.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        titles = [item["title"] for item in response.data]
        # "B Project" < "Core Platform" alfabeticamente -> va primero.
        self.assertEqual(titles, ["B ticket", "Earlier", "Later"])

    # 12.
    def test_places_tickets_without_due_date_last_within_a_project(self) -> None:
        now = timezone.now()
        no_date = self._create_ticket(self.project, self.column, title="Sin fecha", due_date=None)
        with_date = self._create_ticket(self.project, self.column, title="Con fecha", due_date=now + timedelta(days=1))
        for ticket in (no_date, with_date):
            ticket.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        titles = [item["title"] for item in response.data]
        self.assertEqual(titles, ["Con fecha", "Sin fecha"])

    # 13. RB7
    def test_respects_my_tasks_limit_of_500(self) -> None:
        base_time = timezone.now()
        tickets = [
            Ticket(
                project=self.project,
                column=self.column,
                created_by=self.user,
                title=f"Ticket {i}",
                order=1,
                due_date=base_time + timedelta(minutes=i),
            )
            for i in range(501)
        ]
        Ticket.objects.bulk_create(tickets)

        created_tickets = list(Ticket.objects.filter(project=self.project).order_by("due_date"))
        through_model = Ticket.assignees.through
        through_model.objects.bulk_create(
            [through_model(ticket_id=ticket.id, user_id=self.user.id) for ticket in created_tickets]
        )

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 500)
        self.assertEqual(response.data[0]["title"], "Ticket 0")

    # 14.
    def test_response_includes_embedded_project_with_name_key_color_and_workspace_slug(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Con proyecto")
        ticket.assignees.set([self.user])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        project_payload = response.data[0]["project"]
        self.assertEqual(project_payload["id"], str(self.project.id))
        self.assertEqual(project_payload["name"], self.project.name)
        self.assertEqual(project_payload["key"], self.project.key)
        self.assertEqual(project_payload["color"], self.project.color)
        self.assertEqual(project_payload["workspace_slug"], self.workspace.slug)

    # 15.
    def test_response_includes_reference_labels_and_assignees(self) -> None:
        project_with_key = Project.objects.create(workspace=self.workspace, name="Con key", key="KEY")
        column = ProjectColumn.objects.create(project=project_with_key, name="Backlog", order=1)
        label = Label.objects.create(project=project_with_key, name="Bug", color="#DC2626")
        ticket = self._create_ticket(project_with_key, column, title="Con referencia", number=7)
        ticket.assignees.set([self.user])
        ticket.labels.set([label])

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data[0]
        self.assertEqual(payload["reference"], "KEY-7")
        self.assertEqual([item["id"] for item in payload["labels"]], [str(label.id)])
        self.assertEqual([item["id"] for item in payload["assignees"]], [str(self.user.id)])

    # 16. RB4 / D30
    def test_does_not_scale_queries_with_ticket_count(self) -> None:
        projects = []
        for i in range(5):
            project = Project.objects.create(workspace=self.workspace, name=f"Proyecto {i}", key=f"P{i}")
            column = ProjectColumn.objects.create(project=project, name="Backlog", order=1)
            label = Label.objects.create(project=project, name=f"Label {i}", color="#2563EB")
            projects.append((project, column))
            for j in range(4):
                ticket = self._create_ticket(project, column, title=f"Ticket {i}-{j}")
                ticket.assignees.set([self.user])
                ticket.labels.set([label])

        with CaptureQueriesContext(connection) as small_batch:
            response_small = self.client.get("/api/v1/tickets/mine/")
        self.assertEqual(response_small.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_small.data), 20)

        extra_project, extra_column = projects[0]
        for j in range(5):
            ticket = self._create_ticket(extra_project, extra_column, title=f"Extra {j}")
            ticket.assignees.set([self.user])

        with CaptureQueriesContext(connection) as bigger_batch:
            response_big = self.client.get("/api/v1/tickets/mine/")
        self.assertEqual(response_big.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_big.data), 25)

        # Anti-N+1: la cantidad de queries con 25 tickets en 5 proyectos no
        # debe superar la cantidad con 20 (D30).
        self.assertLessEqual(len(bigger_batch.captured_queries), len(small_batch.captured_queries))

    # 17.
    def test_viewer_role_can_read_own_tasks(self) -> None:
        viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=viewer, role=WorkspaceMember.Role.VIEWER, is_active=True
        )
        ticket = self._create_ticket(self.project, self.column, title="Para el viewer")
        ticket.assignees.set([viewer])

        self._login_as("viewer@example.com")

        response = self.client.get("/api/v1/tickets/mine/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["title"] for item in response.data], ["Para el viewer"])
