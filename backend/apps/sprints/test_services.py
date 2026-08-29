from __future__ import annotations

from datetime import date

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from apps.projects.models import Project, ProjectColumn
from apps.sprints.models import Sprint
from apps.sprints.services import activate_sprint, annotate_sprint_progress, get_done_column_id
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace

User = get_user_model()


class GetDoneColumnIdTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")

    def test_get_done_column_id_returns_last_column_by_order(self) -> None:
        ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        ProjectColumn.objects.create(project=self.project, name="En progreso", order=2)
        done = ProjectColumn.objects.create(project=self.project, name="Hecho", order=3)

        self.assertEqual(get_done_column_id(self.project), str(done.id))

    def test_get_done_column_id_returns_none_for_project_without_columns(self) -> None:
        self.assertIsNone(get_done_column_id(self.project))

    def test_get_done_column_id_respects_reordered_columns(self) -> None:
        # El heuristico no mira el nombre: la ultima columna por `order` es
        # "hecho" aunque se llame distinto (RA3).
        ProjectColumn.objects.create(project=self.project, name="Hecho", order=1)
        last = ProjectColumn.objects.create(project=self.project, name="Archivado", order=2)

        self.assertEqual(get_done_column_id(self.project), str(last.id))


class AnnotateSprintProgressTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.done = ProjectColumn.objects.create(project=self.project, name="Hecho", order=2)
        self.sprint = Sprint.objects.create(
            project=self.project,
            name="Sprint 1",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 14),
        )

    def _create_ticket(self, column: ProjectColumn, sprint: Sprint | None = None) -> Ticket:
        ticket = Ticket.objects.create(
            project=self.project,
            column=column,
            created_by=self.user,
            title="Ticket",
        )
        if sprint is not None:
            ticket.sprints.add(sprint)
        return ticket

    def test_annotate_progress_counts_all_sprint_tickets(self) -> None:
        self._create_ticket(self.backlog, sprint=self.sprint)
        self._create_ticket(self.done, sprint=self.sprint)
        self._create_ticket(self.backlog, sprint=None)

        done_column_id = get_done_column_id(self.project)
        qs = annotate_sprint_progress(Sprint.objects.filter(project=self.project), done_column_id)
        sprint = qs.get(pk=self.sprint.pk)

        self.assertEqual(sprint.ticket_count, 2)

    def test_annotate_progress_counts_only_done_column_as_completed(self) -> None:
        self._create_ticket(self.backlog, sprint=self.sprint)
        self._create_ticket(self.done, sprint=self.sprint)
        self._create_ticket(self.done, sprint=self.sprint)

        done_column_id = get_done_column_id(self.project)
        qs = annotate_sprint_progress(Sprint.objects.filter(project=self.project), done_column_id)
        sprint = qs.get(pk=self.sprint.pk)

        self.assertEqual(sprint.ticket_count, 3)
        self.assertEqual(sprint.completed_ticket_count, 2)

    def test_annotate_progress_returns_zero_for_project_without_columns(self) -> None:
        empty_project = Project.objects.create(workspace=self.workspace, name="Sin columnas")
        sprint = Sprint.objects.create(
            project=empty_project,
            name="Sprint vacio",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 14),
        )

        done_column_id = get_done_column_id(empty_project)
        qs = annotate_sprint_progress(Sprint.objects.filter(project=empty_project), done_column_id)
        result = qs.get(pk=sprint.pk)

        self.assertEqual(result.ticket_count, 0)
        self.assertEqual(result.completed_ticket_count, 0)

    def test_annotate_progress_does_not_scale_queries_with_sprint_count(self) -> None:
        for i in range(3):
            Sprint.objects.create(
                project=self.project,
                name=f"Sprint {i}",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 14),
            )

        done_column_id = get_done_column_id(self.project)

        with CaptureQueriesContext(connection) as small_batch:
            list(annotate_sprint_progress(Sprint.objects.filter(project=self.project), done_column_id))

        for i in range(5):
            Sprint.objects.create(
                project=self.project,
                name=f"Sprint extra {i}",
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 14),
            )

        with CaptureQueriesContext(connection) as bigger_batch:
            list(annotate_sprint_progress(Sprint.objects.filter(project=self.project), done_column_id))

        self.assertEqual(len(small_batch.captured_queries), len(bigger_batch.captured_queries))


class ActivateSprintTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")

    def _sprint(self, name: str, status: str = Sprint.Status.PLANNED) -> Sprint:
        return Sprint.objects.create(
            project=self.project,
            name=name,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 14),
            status=status,
        )

    def test_activate_sprint_demotes_previous_active_to_completed(self) -> None:
        first = self._sprint("Sprint 1", status=Sprint.Status.ACTIVE)
        second = self._sprint("Sprint 2")

        activate_sprint(second)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.status, Sprint.Status.COMPLETED)
        self.assertEqual(second.status, Sprint.Status.ACTIVE)

    def test_activate_sprint_is_idempotent_when_already_active(self) -> None:
        sprint = self._sprint("Sprint 1", status=Sprint.Status.ACTIVE)

        activate_sprint(sprint)

        sprint.refresh_from_db()
        self.assertEqual(sprint.status, Sprint.Status.ACTIVE)

    def test_activate_sprint_from_completed_reopens_it(self) -> None:
        sprint = self._sprint("Sprint 1", status=Sprint.Status.COMPLETED)

        activate_sprint(sprint)

        sprint.refresh_from_db()
        self.assertEqual(sprint.status, Sprint.Status.ACTIVE)

    def test_only_one_active_sprint_exists_after_two_activations(self) -> None:
        first = self._sprint("Sprint 1")
        second = self._sprint("Sprint 2")

        activate_sprint(first)
        activate_sprint(second)

        active_count = Sprint.objects.filter(project=self.project, status=Sprint.Status.ACTIVE).count()
        self.assertEqual(active_count, 1)
        second.refresh_from_db()
        self.assertEqual(second.status, Sprint.Status.ACTIVE)
