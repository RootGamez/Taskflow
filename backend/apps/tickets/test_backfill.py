from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.projects.models import Project, ProjectColumn
from apps.tickets.backfill import backfill_ticket_numbers
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace

User = get_user_model()


class BackfillTicketNumbersTests(TestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

    def _make_legacy_ticket(self, title: str, order: int) -> Ticket:
        ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title=title,
            order=order,
        )
        Ticket.objects.filter(id=ticket.id).update(number=None)
        ticket.refresh_from_db()
        return ticket

    def test_numbering_starts_at_one_per_project(self) -> None:
        ticket = self._make_legacy_ticket("Primero", 1)

        backfill_ticket_numbers(Ticket)

        ticket.refresh_from_db()
        self.assertEqual(ticket.number, 1)

    def test_numbering_respects_creation_order(self) -> None:
        first = self._make_legacy_ticket("Primero", 1)
        Ticket.objects.filter(id=first.id).update(created_at="2025-01-01T00:00:00Z")
        second = self._make_legacy_ticket("Segundo", 2)
        Ticket.objects.filter(id=second.id).update(created_at="2025-01-02T00:00:00Z")
        third = self._make_legacy_ticket("Tercero", 3)
        Ticket.objects.filter(id=third.id).update(created_at="2025-01-03T00:00:00Z")

        backfill_ticket_numbers(Ticket)

        first.refresh_from_db()
        second.refresh_from_db()
        third.refresh_from_db()
        self.assertEqual(first.number, 1)
        self.assertEqual(second.number, 2)
        self.assertEqual(third.number, 3)

    def test_does_not_touch_tickets_that_already_have_a_number(self) -> None:
        ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Ya numerado",
            order=1,
        )
        Ticket.objects.filter(id=ticket.id).update(number=42)

        updated_count = backfill_ticket_numbers(Ticket)

        ticket.refresh_from_db()
        self.assertEqual(updated_count, 0)
        self.assertEqual(ticket.number, 42)

    def test_new_tickets_continue_after_existing_numbers(self) -> None:
        numbered = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Ya numerado",
            order=1,
        )
        Ticket.objects.filter(id=numbered.id).update(number=5)
        legacy = self._make_legacy_ticket("Legacy", 2)

        backfill_ticket_numbers(Ticket)

        legacy.refresh_from_db()
        self.assertEqual(legacy.number, 6)

    def test_idempotent_second_run_changes_nothing(self) -> None:
        self._make_legacy_ticket("Primero", 1)
        self._make_legacy_ticket("Segundo", 2)

        first_run = backfill_ticket_numbers(Ticket)
        numbers_after_first_run = list(
            Ticket.objects.filter(project=self.project).order_by("order").values_list("number", flat=True)
        )

        second_run = backfill_ticket_numbers(Ticket)
        numbers_after_second_run = list(
            Ticket.objects.filter(project=self.project).order_by("order").values_list("number", flat=True)
        )

        self.assertGreater(first_run, 0)
        self.assertEqual(second_run, 0)
        self.assertEqual(numbers_after_first_run, numbers_after_second_run)

    def test_different_projects_number_independently_starting_at_one(self) -> None:
        other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")
        other_column = ProjectColumn.objects.create(project=other_project, name="Backlog", order=1)
        ticket_a = self._make_legacy_ticket("Proyecto A", 1)
        ticket_b = Ticket.objects.create(
            project=other_project,
            column=other_column,
            created_by=self.owner,
            title="Proyecto B",
            order=1,
        )
        Ticket.objects.filter(id=ticket_b.id).update(number=None)
        ticket_b.refresh_from_db()

        backfill_ticket_numbers(Ticket)

        ticket_a.refresh_from_db()
        ticket_b.refresh_from_db()
        self.assertEqual(ticket_a.number, 1)
        self.assertEqual(ticket_b.number, 1)

    def test_backfill_only_changes_number_field_nothing_else(self) -> None:
        ticket = self._make_legacy_ticket("Primero", 1)
        original_column_id = ticket.column_id
        original_order = ticket.order
        original_title = ticket.title

        backfill_ticket_numbers(Ticket)

        ticket.refresh_from_db()
        self.assertEqual(ticket.column_id, original_column_id)
        self.assertEqual(ticket.order, original_order)
        self.assertEqual(ticket.title, original_title)
        self.assertIsNotNone(ticket.number)
