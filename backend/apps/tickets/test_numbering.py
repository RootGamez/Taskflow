from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase

from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.tickets.numbering import allocate_ticket_number
from apps.workspaces.models import Workspace

User = get_user_model()


class AllocateTicketNumberTests(TestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

    def _create_ticket_via_allocation(self, project: Project, title: str) -> Ticket:
        """Simula el camino real de creacion de un ticket: pide el numero
        via `allocate_ticket_number` (dentro de una transaccion, como hace
        `TicketCreateSerializer.create()`) y recien despues crea la fila.
        """
        with transaction.atomic():
            number = allocate_ticket_number(project)
            return Ticket.objects.create(
                project=project,
                column=self.column if project == self.project else project.columns.first(),
                created_by=self.owner,
                title=title,
                order=number,
                number=number,
            )

    def test_first_ticket_of_project_is_number_one(self) -> None:
        with transaction.atomic():
            number = allocate_ticket_number(self.project)

        self.assertEqual(number, 1)

    def test_second_ticket_is_number_two(self) -> None:
        self._create_ticket_via_allocation(self.project, "Primero")

        with transaction.atomic():
            number = allocate_ticket_number(self.project)

        self.assertEqual(number, 2)

    def test_deleted_ticket_number_is_never_reused(self) -> None:
        self._create_ticket_via_allocation(self.project, "Primero")
        second = self._create_ticket_via_allocation(self.project, "Segundo")
        second.delete()

        with transaction.atomic():
            number = allocate_ticket_number(self.project)

        self.assertEqual(number, 3)

    def test_numbering_is_independent_per_project(self) -> None:
        self._create_ticket_via_allocation(self.project, "Primero")
        other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")
        ProjectColumn.objects.create(project=other_project, name="Backlog", order=1)

        with transaction.atomic():
            number = allocate_ticket_number(other_project)

        self.assertEqual(number, 1)
