"""Tests de `GET /api/v1/search/tickets/` (WP-A, Fase 3).

Reescritura completa del stub de WP-0 (docs/PHASE_3_PLAN.md, seccion 4.5).
Conserva los 2 tests de contrato que ya pasaban contra el stub (auth
requerida, no colision de rutas) y agrega la cobertura real: ranking
determinista (D18), busqueda por referencia exacta (D19), scope
cross-workspace (D20/RA1 -- la superficie de mas riesgo de seguridad de
toda la fase), degradacion de parametros invalidos (D16) y forma de
respuesta lean (D17).
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class SearchTicketsViewTests(APITestCase):
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
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform", key="TASK")
        self.column = ProjectColumn.objects.create(project=self.project, name="En progreso", order=1)
        self._login()

    def _login(self, email: str = "owner@example.com", password: str = "Passw0rd!123") -> None:
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

    def _search(self, **params):
        return self.client.get("/api/v1/search/tickets/", params)

    # 1. conservar del stub
    def test_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get("/api/v1/search/tickets/", {"q": "buscable"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 2. conservar del stub
    def test_search_route_does_not_collide_with_ticket_single_view(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Ticket real")

        single_response = self.client.get(f"/api/v1/tickets/{ticket.id}/")
        mine_response = self.client.get("/api/v1/tickets/mine/")
        search_response = self._search(q="real")

        self.assertEqual(single_response.status_code, status.HTTP_200_OK)
        self.assertEqual(single_response.data["id"], str(ticket.id))
        self.assertEqual(mine_response.status_code, status.HTTP_200_OK)
        self.assertEqual(search_response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in search_response.data], [str(ticket.id)])

    # 3. D16
    def test_returns_empty_list_when_q_is_missing(self) -> None:
        self._create_ticket(self.project, self.column, title="Cualquiera")

        response = self._search()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 4. D16
    def test_returns_empty_list_when_q_is_shorter_than_two_chars(self) -> None:
        self._create_ticket(self.project, self.column, title="A")

        response = self._search(q="a")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 5.
    def test_matches_by_title_case_insensitively(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Arreglar el LOGIN con Google")

        response = self._search(q="login")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(ticket.id)])

    # 6. requisito 2 del brief
    def test_matches_by_description_text(self) -> None:
        ticket = self._create_ticket(
            self.project,
            self.column,
            title="Sin relacion en el titulo",
            description_text="El bug aparece al usar autenticacion federada",
        )

        response = self._search(q="federada")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(ticket.id)])

    # 7. hallazgo 0.2 del plan
    def test_does_not_match_tiptap_json_structural_keys(self) -> None:
        self._create_ticket(
            self.project,
            self.column,
            title="Ticket cualquiera",
            description_text="Un parrafo de texto real, sin claves de tiptap",
        )

        response = self._search(q="paragraph")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 8. D19
    def test_matches_by_exact_reference(self) -> None:
        target = self._create_ticket(self.project, self.column, title="Objetivo", number=142)
        self._create_ticket(self.project, self.column, title="Otro", number=143)

        response = self._search(q="TASK-142")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(target.id)])

    # 9. D18
    def test_reference_match_ranks_first(self) -> None:
        by_reference = self._create_ticket(self.project, self.column, title="Zzz", number=142)
        by_title = self._create_ticket(self.project, self.column, title="TASK-142 mencionado en el titulo")

        response = self._search(q="TASK-142")

        ids = [item["id"] for item in response.data]
        self.assertEqual(ids[0], str(by_reference.id))
        self.assertIn(str(by_title.id), ids)

    # 10. D18
    def test_title_prefix_ranks_above_title_contains(self) -> None:
        contains = self._create_ticket(self.project, self.column, title="Un login raro en produccion")
        prefix = self._create_ticket(self.project, self.column, title="Login roto en Google")

        response = self._search(q="login")

        ids = [item["id"] for item in response.data]
        self.assertEqual(ids, [str(prefix.id), str(contains.id)])

    # 11. D18
    def test_title_contains_ranks_above_description_match(self) -> None:
        by_description = self._create_ticket(
            self.project,
            self.column,
            title="Sin relacion",
            description_text="Esto habla de login federado",
        )
        by_title = self._create_ticket(self.project, self.column, title="Arreglar login")

        response = self._search(q="login")

        ids = [item["id"] for item in response.data]
        self.assertEqual(ids, [str(by_title.id), str(by_description.id)])

    # 12. D18
    def test_ordering_is_stable_for_equal_ranks(self) -> None:
        project_b = Project.objects.create(workspace=self.workspace, name="B Project", key="BPRJ")
        column_b = ProjectColumn.objects.create(project=project_b, name="Backlog", order=1)

        ticket_a = self._create_ticket(self.project, self.column, title="Login falla")
        ticket_b = self._create_ticket(project_b, column_b, title="Login falla tambien")

        response = self._search(q="login")

        ids = [item["id"] for item in response.data]
        # "B Project" < "Core Platform" alfabeticamente -> desempata primero.
        self.assertEqual(ids, [str(ticket_b.id), str(ticket_a.id)])

    # 13. D20
    def test_searches_across_all_member_workspaces_when_workspace_is_omitted(self) -> None:
        other_workspace = Workspace.objects.create(name="Otro espacio", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=other_workspace, user=self.user, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        other_project = Project.objects.create(workspace=other_workspace, name="Growth")
        other_column = ProjectColumn.objects.create(project=other_project, name="Backlog", order=1)

        ticket_a = self._create_ticket(self.project, self.column, title="Login A")
        ticket_b = self._create_ticket(other_project, other_column, title="Login B")

        response = self._search(q="login")

        ids = {item["id"] for item in response.data}
        self.assertEqual(ids, {str(ticket_a.id), str(ticket_b.id)})

    # 14. D20
    def test_scopes_to_a_single_workspace_when_workspace_slug_is_given(self) -> None:
        other_workspace = Workspace.objects.create(name="Otro espacio", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=other_workspace, user=self.user, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        other_project = Project.objects.create(workspace=other_workspace, name="Growth")
        other_column = ProjectColumn.objects.create(project=other_project, name="Backlog", order=1)

        ticket_a = self._create_ticket(self.project, self.column, title="Login A")
        self._create_ticket(other_project, other_column, title="Login B")

        response = self._search(q="login", workspace=self.workspace.slug)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(ticket_a.id)])

    # 15. RA1 -- CRITICO
    def test_never_returns_tickets_from_a_workspace_the_user_is_not_a_member_of(self) -> None:
        other_owner = User.objects.create_user(
            email="other-owner@example.com", full_name="Other Owner", password="Passw0rd!123"
        )
        other_workspace = Workspace.objects.create(name="Workspace ajeno", owner=other_owner)
        WorkspaceMember.objects.create(
            workspace=other_workspace, user=other_owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        other_project = Project.objects.create(workspace=other_workspace, name="Proyecto ajeno")
        other_column = ProjectColumn.objects.create(project=other_project, name="Backlog", order=1)
        Ticket.objects.create(
            project=other_project,
            column=other_column,
            created_by=other_owner,
            title="Solo el dueño ajeno deberia ver esto",
            order=1,
        )

        response = self._search(q="dueño")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 16. RA1
    def test_excludes_tickets_from_workspaces_the_user_was_removed_from(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Se va del workspace")

        response_before = self._search(q="workspace")
        self.assertEqual([item["id"] for item in response_before.data], [str(ticket.id)])

        WorkspaceMember.objects.filter(user=self.user, workspace=self.workspace).delete()

        response_after = self._search(q="workspace")
        self.assertEqual(response_after.status_code, status.HTTP_200_OK)
        self.assertEqual(response_after.data, [])

    # 17.
    def test_excludes_tickets_from_archived_projects(self) -> None:
        archived_project = Project.objects.create(workspace=self.workspace, name="Legacy", is_archived=True)
        archived_column = ProjectColumn.objects.create(project=archived_project, name="Backlog", order=1)
        self._create_ticket(archived_project, archived_column, title="Login archivado")

        response = self._search(q="login")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

    # 18.
    def test_respects_the_limit_param(self) -> None:
        for i in range(5):
            self._create_ticket(self.project, self.column, title=f"Login {i}")

        response = self._search(q="login", limit=2)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    # 19. D16
    def test_clamps_limit_above_the_maximum(self) -> None:
        for i in range(60):
            self._create_ticket(self.project, self.column, title=f"Login {i}")

        response = self._search(q="login", limit=9999)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 50)

    # 20. D16
    def test_clamps_limit_below_one(self) -> None:
        self._create_ticket(self.project, self.column, title="Login unico")

        response = self._search(q="login", limit=0)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    # 21. RA3
    def test_handles_percent_and_underscore_literally(self) -> None:
        literal_match = self._create_ticket(self.project, self.column, title="Descuento 50% aplicado")
        self._create_ticket(self.project, self.column, title="Descuento 50X aplicado")

        response = self._search(q="50%")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(literal_match.id)])

    # 22. RA3 -- query de 1 solo codepoint (ej. un unico emoji) sigue
    # cayendo bajo SEARCH_MIN_QUERY_LENGTH (D16): se usan 2 emojis
    # consecutivos para probar el manejo de unicode/emoji sin chocar con
    # esa regla, que ya tiene su propio test dedicado (# 4).
    def test_handles_unicode_and_emoji_queries(self) -> None:
        ticket = self._create_ticket(self.project, self.column, title="Lanzamiento 🚀🚀 en producción")

        response = self._search(q="🚀🚀")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(ticket.id)])

    # 23.
    def test_does_not_scale_queries_with_result_count(self) -> None:
        for i in range(3):
            self._create_ticket(self.project, self.column, title=f"Login {i}")

        with CaptureQueriesContext(connection) as small_batch:
            response_small = self._search(q="login")
        self.assertEqual(response_small.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_small.data), 3)

        for i in range(3, 10):
            self._create_ticket(self.project, self.column, title=f"Login {i}")

        with CaptureQueriesContext(connection) as bigger_batch:
            response_big = self._search(q="login")
        self.assertEqual(response_big.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_big.data), 10)

        self.assertLessEqual(len(bigger_batch.captured_queries), len(small_batch.captured_queries))

    # 24. D17
    def test_response_shape_is_lean_and_excludes_description(self) -> None:
        self._create_ticket(
            self.project,
            self.column,
            title="Login lean",
            description_text="No deberia viajar en la respuesta",
            number=7,
        )

        response = self._search(q="login")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data[0]
        self.assertEqual(
            set(payload.keys()),
            {"id", "title", "reference", "priority", "due_date", "column_name", "project"},
        )
        self.assertEqual(payload["reference"], "TASK-7")
        self.assertEqual(payload["column_name"], self.column.name)
        self.assertEqual(
            set(payload["project"].keys()),
            {"id", "name", "key", "color", "workspace_slug"},
        )

    # 25.
    def test_viewer_role_can_search(self) -> None:
        viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=viewer, role=WorkspaceMember.Role.VIEWER, is_active=True
        )
        ticket = self._create_ticket(self.project, self.column, title="Visible para el viewer")

        self._login(email="viewer@example.com")

        response = self._search(q="viewer")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [str(ticket.id)])

    # 26. D20 -- workspace explicito de un workspace ajeno no debe filtrar existencia
    def test_scoping_to_a_foreign_workspace_returns_404(self) -> None:
        other_owner = User.objects.create_user(
            email="foreign-owner@example.com", full_name="Foreign Owner", password="Passw0rd!123"
        )
        foreign_workspace = Workspace.objects.create(name="Ajeno", owner=other_owner)
        WorkspaceMember.objects.create(
            workspace=foreign_workspace, user=other_owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )

        response = self._search(q="login", workspace=foreign_workspace.slug)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
