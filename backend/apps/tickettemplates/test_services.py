from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.projects.models import Project, ProjectColumn
from apps.subtasks.views import MAX_SUBTASKS_PER_TICKET
from apps.tickets.models import Ticket
from apps.tickettemplates.models import TicketTemplate, TicketTemplateItem
from apps.tickettemplates.services import apply_template_items
from apps.workspaces.models import Workspace

User = get_user_model()


class ApplyTemplateItemsTests(TestCase):
    """apps/tickettemplates/test_services.py (docs/PHASE_4_PLAN.md seccion
    5.5, tests 1-6): `apply_template_items` crea el checklist (`SubTask`) de
    una plantilla sobre un ticket ya creado, dentro de la transaccion de
    creacion del ticket (D20). Usa `TestCase` con DB real (a diferencia de
    `apps/pages/test_services.py`, que testea funciones puras sin DB) porque
    esta funcion crea filas.
    """

    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.user,
            title="Ticket base",
        )

    def _make_template(self, item_titles: list[str]) -> TicketTemplate:
        template = TicketTemplate.objects.create(
            project=self.project,
            name="Bug report",
            created_by=self.user,
        )
        for index, title in enumerate(item_titles, start=1):
            TicketTemplateItem.objects.create(template=template, title=title, order=index)
        return template

    def test_apply_template_items_creates_one_subtask_per_item(self) -> None:
        template = self._make_template(["Paso 1", "Paso 2", "Paso 3"])

        created_count = apply_template_items(self.ticket, template, self.user)

        self.assertEqual(created_count, 3)
        self.assertEqual(self.ticket.subtasks.count(), 3)
        self.assertEqual(
            list(self.ticket.subtasks.order_by("order").values_list("title", flat=True)),
            ["Paso 1", "Paso 2", "Paso 3"],
        )

    def test_apply_template_items_preserves_order(self) -> None:
        template = self._make_template(["Primero", "Segundo", "Tercero"])

        apply_template_items(self.ticket, template, self.user)

        titles_in_order = list(self.ticket.subtasks.order_by("order").values_list("title", flat=True))
        self.assertEqual(titles_in_order, ["Primero", "Segundo", "Tercero"])

    def test_apply_template_items_returns_the_created_count(self) -> None:
        template = self._make_template(["A", "B"])

        created_count = apply_template_items(self.ticket, template, self.user)

        self.assertEqual(created_count, 2)

    def test_apply_template_items_is_a_no_op_for_a_template_without_items(self) -> None:
        template = self._make_template([])

        created_count = apply_template_items(self.ticket, template, self.user)

        self.assertEqual(created_count, 0)
        self.assertEqual(self.ticket.subtasks.count(), 0)

    def test_apply_template_items_truncates_at_the_subtask_limit(self) -> None:
        # D25 limita las plantillas reales a 50 items desde el serializer;
        # este test construye el modelo directo para simular el caso limite
        # de D26 (el limite pudiera cambiar en el futuro) sin pasar por esa
        # validacion de escritura.
        item_titles = [f"Item {i}" for i in range(MAX_SUBTASKS_PER_TICKET + 10)]
        template = self._make_template(item_titles)

        with self.assertLogs("apps.tickettemplates.services", level="WARNING"):
            created_count = apply_template_items(self.ticket, template, self.user)

        self.assertEqual(created_count, MAX_SUBTASKS_PER_TICKET)
        self.assertEqual(self.ticket.subtasks.count(), MAX_SUBTASKS_PER_TICKET)

    def test_apply_template_items_sets_created_by(self) -> None:
        template = self._make_template(["Unico"])

        apply_template_items(self.ticket, template, self.user)

        subtask = self.ticket.subtasks.get()
        self.assertEqual(subtask.created_by_id, self.user.id)
