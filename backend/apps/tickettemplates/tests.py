from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.subtasks.models import SubTask
from apps.tickets.models import Ticket
from apps.tickettemplates.models import TicketTemplate, TicketTemplateItem
from apps.tickettemplates.services import apply_template_items
from apps.tickettemplates.views import MAX_TEMPLATES_PER_PROJECT
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class TicketTemplateApiTestsBase(APITestCase):
    """Suite HTTP (APITestCase) de WP-T (docs/PHASE_4_PLAN.md seccion 5.5,
    tests 7-26). El stub `apply_template_items` y el contrato de
    `template_id` en `TicketCreateSerializer` ya estan probados en
    apps/tickets/tests.py::TicketTemplateIdContractTests (WP-0A).
    """

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
        self.other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")

    def _login_as_viewer(self) -> None:
        viewer = User.objects.create_user(
            email="viewer@example.com",
            full_name="Viewer",
            password="Passw0rd!123",
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=viewer,
            role=WorkspaceMember.Role.VIEWER,
            is_active=True,
        )
        login_response = self.client.post(
            "/api/v1/auth/login/",
            {"email": "viewer@example.com", "password": "Passw0rd!123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")


class TicketTemplateListCreateTests(TicketTemplateApiTestsBase):
    def test_list_templates_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get(f"/api/v1/projects/{self.project.id}/ticket-templates/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_templates_from_a_foreign_workspace_returns_404(self) -> None:
        foreign_workspace = Workspace.objects.create(
            name="No soy miembro",
            owner=User.objects.create_user(email="otro@example.com", full_name="Otro", password="Passw0rd!123"),
        )
        foreign_project = Project.objects.create(workspace=foreign_workspace, name="Ajeno de verdad")

        response = self.client.get(f"/api/v1/projects/{foreign_project.id}/ticket-templates/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_templates_includes_items_ordered(self) -> None:
        template = TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)
        TicketTemplateItem.objects.create(template=template, title="Segundo", order=2)
        TicketTemplateItem.objects.create(template=template, title="Primero", order=1)

        response = self.client.get(f"/api/v1/projects/{self.project.id}/ticket-templates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.data[0]["items"]
        self.assertEqual([item["title"] for item in items], ["Primero", "Segundo"])

    def test_list_templates_does_not_scale_queries(self) -> None:
        for index in range(5):
            template = TicketTemplate.objects.create(
                project=self.project, name=f"Plantilla {index}", created_by=self.user
            )
            TicketTemplateItem.objects.create(template=template, title="Item", order=1)

        with CaptureQueriesContext(connection) as one_template_queries:
            self.client.get(f"/api/v1/projects/{self.project.id}/ticket-templates/")
        query_count_for_five = len(one_template_queries)

        TicketTemplate.objects.create(project=self.project, name="Plantilla extra", created_by=self.user)

        with CaptureQueriesContext(connection) as more_templates_queries:
            self.client.get(f"/api/v1/projects/{self.project.id}/ticket-templates/")

        # No debe crecer con la cantidad de plantillas -- `prefetch_related`
        # mantiene una sola query extra para `items`, no una por plantilla.
        self.assertEqual(len(more_templates_queries), query_count_for_five)

    def test_list_templates_as_viewer_returns_200(self) -> None:
        TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)
        self._login_as_viewer()

        response = self.client.get(f"/api/v1/projects/{self.project.id}/ticket-templates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_create_template_returns_201(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "Bug report", "title_template": "[BUG] ", "priority": "high"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["name"], "Bug report")
        self.assertEqual(response.data["title_template"], "[BUG] ")
        self.assertEqual(response.data["priority"], "high")
        self.assertEqual(response.data["project_id"], str(self.project.id))
        self.assertEqual(response.data["items"], [])

    def test_create_template_with_items_creates_them_in_order(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "Bug report", "items": ["Pasos para reproducir", "Comportamiento esperado"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        titles = [item["title"] for item in response.data["items"]]
        orders = [item["order"] for item in response.data["items"]]
        self.assertEqual(titles, ["Pasos para reproducir", "Comportamiento esperado"])
        self.assertEqual(orders, [1, 2])

    def test_create_template_strips_and_drops_blank_items(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "Bug report", "items": ["  ", "ok", ""]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(len(response.data["items"]), 1)
        self.assertEqual(response.data["items"][0]["title"], "ok")

    def test_create_template_with_a_duplicate_name_returns_400_not_500(self) -> None:
        TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "Bug report"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_create_template_name_uniqueness_is_case_insensitive(self) -> None:
        TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "BUG REPORT"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_template_as_viewer_returns_403(self) -> None:
        self._login_as_viewer()

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "Bug report"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creating_the_21st_template_returns_400(self) -> None:
        for index in range(MAX_TEMPLATES_PER_PROJECT):
            TicketTemplate.objects.create(project=self.project, name=f"Plantilla {index}", created_by=self.user)

        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "La 21"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_creating_a_template_with_51_items_returns_400(self) -> None:
        response = self.client.post(
            f"/api/v1/projects/{self.project.id}/ticket-templates/",
            {"name": "Checklist enorme", "items": [f"Item {i}" for i in range(51)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(TicketTemplate.objects.filter(name="Checklist enorme").exists())


class TicketTemplateDetailTests(TicketTemplateApiTestsBase):
    def setUp(self) -> None:
        super().setUp()
        self.template = TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)
        TicketTemplateItem.objects.create(template=self.template, title="Item viejo", order=1)

    def test_patch_template_replaces_the_whole_item_set(self) -> None:
        response = self.client.patch(
            f"/api/v1/projects/{self.project.id}/ticket-templates/{self.template.id}/",
            {"items": ["Item nuevo A", "Item nuevo B"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        titles = [item["title"] for item in response.data["items"]]
        self.assertEqual(titles, ["Item nuevo A", "Item nuevo B"])
        self.assertEqual(self.template.items.count(), 2)

    def test_patch_template_as_viewer_returns_403(self) -> None:
        self._login_as_viewer()

        response = self.client.patch(
            f"/api/v1/projects/{self.project.id}/ticket-templates/{self.template.id}/",
            {"name": "Otro nombre"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_template_from_another_project_returns_404(self) -> None:
        response = self.client.patch(
            f"/api/v1/projects/{self.other_project.id}/ticket-templates/{self.template.id}/",
            {"name": "Otro nombre"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_template_returns_204(self) -> None:
        response = self.client.delete(
            f"/api/v1/projects/{self.project.id}/ticket-templates/{self.template.id}/",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TicketTemplate.objects.filter(id=self.template.id).exists())

    def test_deleting_the_template_deletes_its_items(self) -> None:
        item_id = self.template.items.first().id

        self.client.delete(f"/api/v1/projects/{self.project.id}/ticket-templates/{self.template.id}/")

        self.assertFalse(TicketTemplateItem.objects.filter(id=item_id).exists())


class TicketTemplateCascadeTests(TicketTemplateApiTestsBase):
    """RT-1/RT-2/D22: relacion entre `TicketTemplate` y el resto del
    dominio en cascada (o, deliberadamente, su ausencia)."""

    def test_deleting_the_project_deletes_its_templates(self) -> None:
        template = TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)

        self.project.delete()

        self.assertFalse(TicketTemplate.objects.filter(id=template.id).exists())

    def test_deleting_a_template_does_not_touch_tickets_created_from_it(self) -> None:
        # D22: NO existe `Ticket.template` -- una plantilla es una fabrica,
        # no una relacion. Se crea un ticket real con un checklist generado
        # a partir de la plantilla (via `apply_template_items`, el mismo
        # camino que usa `TicketCreateSerializer.create`) y despues se borra
        # la plantilla: el ticket y sus subtareas quedan intactos.
        template = TicketTemplate.objects.create(project=self.project, name="Bug report", created_by=self.user)
        TicketTemplateItem.objects.create(template=template, title="Paso 1", order=1)
        column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        ticket = Ticket.objects.create(
            project=self.project,
            column=column,
            created_by=self.user,
            title="Ticket con checklist de plantilla",
        )
        apply_template_items(ticket, template, self.user)
        self.assertEqual(ticket.subtasks.count(), 1)

        response = self.client.delete(
            f"/api/v1/projects/{self.project.id}/ticket-templates/{template.id}/",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(Ticket.objects.filter(id=ticket.id).exists())
        self.assertEqual(SubTask.objects.filter(ticket=ticket).count(), 1)
