"""Tests unitarios de `apps.activities.services` — la pieza más crítica de
esta tanda. Ejercitan `TicketCreateSerializer`/`TicketUpdateSerializer`
directamente (sin pasar por HTTP) para validar el hook real que dispara las
actividades, cubriendo D6 (coalescencia de title_changed), D7 (campos
excluidos) y D8 (reordenar en la misma columna no es status_changed).
"""

from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.activities import services as activities_services
from apps.activities.models import Activity
from apps.projects.models import Project, ProjectColumn
from apps.sprints.models import Sprint
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketCreateSerializer, TicketUpdateSerializer
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


@pytest.fixture
def actor(db):
    return User.objects.create_user(email="actor@example.com", full_name="Actor Uno", password="Passw0rd!123")


@pytest.fixture
def other_actor(db):
    return User.objects.create_user(email="otro@example.com", full_name="Otra Persona", password="Passw0rd!123")


@pytest.fixture
def project(actor):
    workspace = Workspace.objects.create(name="Producto", owner=actor)
    WorkspaceMember.objects.create(
        workspace=workspace, user=actor, role=WorkspaceMember.Role.OWNER, is_active=True
    )
    return Project.objects.create(workspace=workspace, name="Core Platform")


@pytest.fixture
def backlog(project):
    return ProjectColumn.objects.create(project=project, name="Backlog", order=1)


@pytest.fixture
def in_progress(project):
    return ProjectColumn.objects.create(project=project, name="En progreso", order=2)


@pytest.fixture
def sprint(project):
    return Sprint.objects.create(
        project=project,
        name="Sprint 1",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 14),
    )


def _fake_request(user):
    return SimpleNamespace(user=user)


def _create_ticket(project: Project, column: ProjectColumn, actor, **overrides) -> Ticket:
    payload = {"title": "Ticket base", "column_id": str(column.id), **overrides}
    serializer = TicketCreateSerializer(data=payload, context={"project": project, "request": _fake_request(actor)})
    assert serializer.is_valid(), serializer.errors
    return serializer.save()


def _update_ticket(ticket: Ticket, project: Project, actor, payload: dict) -> Ticket:
    serializer = TicketUpdateSerializer(
        ticket, data=payload, partial=True, context={"project": project, "actor": actor}
    )
    assert serializer.is_valid(), serializer.errors
    return serializer.save()


# --- take_snapshot -----------------------------------------------------


@pytest.mark.django_db
def test_take_snapshot_captures_pre_change_state(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor, priority="low")
    ticket.assignees.set([actor.id])
    ticket = Ticket.objects.select_related("column").get(id=ticket.id)

    snapshot = activities_services.take_snapshot(ticket)

    assert snapshot.title == ticket.title
    assert snapshot.priority == "low"
    assert snapshot.column_id == backlog.id
    assert snapshot.column_name == "Backlog"
    assert snapshot.due_date is None
    assert snapshot.assignee_ids == frozenset({actor.id})


# --- record_ticket_created ----------------------------------------------


@pytest.mark.django_db
def test_create_emits_exactly_one_created_activity(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor, priority="high")

    activities = list(Activity.objects.filter(ticket=ticket))

    assert len(activities) == 1
    assert activities[0].action == Activity.Action.CREATED
    assert activities[0].actor_id == actor.id
    assert activities[0].from_value is None
    assert activities[0].to_value is None


# --- record_ticket_changes: status_changed / D8 --------------------------


@pytest.mark.django_db
def test_moving_to_another_column_emits_status_changed(project, backlog, in_progress, actor):
    ticket = _create_ticket(project, backlog, actor)
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"column_id": str(in_progress.id), "order": 1})

    activities = list(Activity.objects.filter(ticket=ticket, action=Activity.Action.STATUS_CHANGED))
    assert len(activities) == 1
    assert activities[0].from_value == {"id": str(backlog.id), "label": "Backlog"}
    assert activities[0].to_value == {"id": str(in_progress.id), "label": "En progreso"}


@pytest.mark.django_db
def test_reordering_within_same_column_emits_nothing(project, backlog, actor):
    ticket_a = _create_ticket(project, backlog, actor, title="A")
    _create_ticket(project, backlog, actor, title="B")
    Activity.objects.all().delete()

    _update_ticket(ticket_a, project, actor, {"column_id": str(backlog.id), "order": 2})

    assert not Activity.objects.filter(ticket=ticket_a).exists()


# --- record_ticket_changes: no-ops ---------------------------------------


@pytest.mark.django_db
def test_patch_with_same_value_emits_nothing(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor, priority="high")
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"priority": "high"})

    assert not Activity.objects.filter(ticket=ticket).exists()


@pytest.mark.django_db
def test_description_change_emits_nothing(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor)
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"description": "Contenido nuevo"})

    assert not Activity.objects.filter(ticket=ticket).exists()


@pytest.mark.django_db
def test_progress_notes_change_emits_nothing(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor)
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"progress_notes": "Avance nuevo"})

    assert not Activity.objects.filter(ticket=ticket).exists()


# --- record_ticket_changes: priority --------------------------------------


@pytest.mark.django_db
def test_priority_change_emits_priority_changed_with_denormalized_labels(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor, priority="medium")
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"priority": "high"})

    activity = Activity.objects.get(ticket=ticket, action=Activity.Action.PRIORITY_CHANGED)
    assert activity.from_value == {"id": "medium", "label": Ticket.Priority("medium").label}
    assert activity.to_value == {"id": "high", "label": Ticket.Priority("high").label}


# --- record_ticket_changes: assignees -------------------------------------


@pytest.mark.django_db
def test_assignee_diff_emits_assigned_and_unassigned(project, backlog, actor, other_actor):
    third = User.objects.create_user(email="tercero@example.com", full_name="Tercera Persona", password="Passw0rd!123")
    fourth = User.objects.create_user(email="cuarto@example.com", full_name="Cuarta Persona", password="Passw0rd!123")

    ticket = _create_ticket(project, backlog, actor, assignee_ids=[str(other_actor.id)])
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"assignee_ids": [str(third.id), str(fourth.id)]})

    assigned = Activity.objects.filter(ticket=ticket, action=Activity.Action.ASSIGNED)
    unassigned = Activity.objects.filter(ticket=ticket, action=Activity.Action.UNASSIGNED)

    assert assigned.count() == 2
    assert {row.to_value["id"] for row in assigned} == {str(third.id), str(fourth.id)}
    assert {row.to_value["label"] for row in assigned} == {third.full_name, fourth.full_name}

    assert unassigned.count() == 1
    assert unassigned.first().from_value == {"id": str(other_actor.id), "label": other_actor.full_name}
    assert unassigned.first().to_value is None


# --- record_ticket_changes: title coalescing (D6) -------------------------


@pytest.mark.django_db
def test_title_coalescing_within_window_updates_single_row(project, backlog, actor):
    frozen_now = timezone.now()
    with patch("django.utils.timezone.now", return_value=frozen_now):
        ticket = _create_ticket(project, backlog, actor, title="Original")
        Activity.objects.all().delete()

        _update_ticket(ticket, project, actor, {"title": "H"})
        _update_ticket(ticket, project, actor, {"title": "Ho"})
        _update_ticket(ticket, project, actor, {"title": "Hola"})

    rows = Activity.objects.filter(ticket=ticket, action=Activity.Action.TITLE_CHANGED)
    assert rows.count() == 1
    row = rows.first()
    assert row.from_value == {"id": None, "label": "Original"}
    assert row.to_value == {"id": None, "label": "Hola"}


@pytest.mark.django_db
def test_title_coalescing_different_actor_creates_two_rows(project, backlog, actor, other_actor):
    frozen_now = timezone.now()
    with patch("django.utils.timezone.now", return_value=frozen_now):
        ticket = _create_ticket(project, backlog, actor, title="Original")
        Activity.objects.all().delete()

        _update_ticket(ticket, project, actor, {"title": "Cambio de A"})
        _update_ticket(ticket, project, other_actor, {"title": "Cambio de B"})

    rows = Activity.objects.filter(ticket=ticket, action=Activity.Action.TITLE_CHANGED)
    assert rows.count() == 2


@pytest.mark.django_db
def test_title_coalescing_outside_window_creates_two_rows(project, backlog, actor):
    start = timezone.now()
    later = start + timedelta(seconds=activities_services.ACTIVITY_COALESCE_WINDOW_SECONDS + 1)

    with patch("django.utils.timezone.now", return_value=start):
        ticket = _create_ticket(project, backlog, actor, title="Original")
        Activity.objects.all().delete()
        _update_ticket(ticket, project, actor, {"title": "Cambio uno"})

    with patch("django.utils.timezone.now", return_value=later):
        _update_ticket(ticket, project, actor, {"title": "Cambio dos"})

    rows = Activity.objects.filter(ticket=ticket, action=Activity.Action.TITLE_CHANGED)
    assert rows.count() == 2


@pytest.mark.django_db
def test_title_coalescing_back_to_original_deletes_row(project, backlog, actor):
    frozen_now = timezone.now()
    with patch("django.utils.timezone.now", return_value=frozen_now):
        ticket = _create_ticket(project, backlog, actor, title="Original")
        Activity.objects.all().delete()

        _update_ticket(ticket, project, actor, {"title": "Temporal"})
        _update_ticket(ticket, project, actor, {"title": "Original"})

    assert not Activity.objects.filter(ticket=ticket, action=Activity.Action.TITLE_CHANGED).exists()


# --- record_ticket_changes: due_date --------------------------------------


@pytest.mark.django_db
def test_due_date_change_to_none_sets_to_value_none(project, backlog, actor):
    due = timezone.now() + timedelta(days=3)
    ticket = _create_ticket(project, backlog, actor, due_date=due.isoformat())
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"due_date": None})

    activity = Activity.objects.get(ticket=ticket, action=Activity.Action.DUE_DATE_CHANGED)
    assert activity.to_value is None
    assert activity.from_value is not None


@pytest.mark.django_db
def test_due_date_change_from_none_sets_from_value_none(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor)
    Activity.objects.all().delete()
    due = timezone.now() + timedelta(days=1)

    _update_ticket(ticket, project, actor, {"due_date": due.isoformat()})

    activity = Activity.objects.get(ticket=ticket, action=Activity.Action.DUE_DATE_CHANGED)
    assert activity.from_value is None
    assert activity.to_value is not None


# --- record_comment_created ------------------------------------------------


@pytest.mark.django_db
def test_record_comment_created_uses_ticket_and_author_from_comment(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor)
    Activity.objects.all().delete()
    fake_comment = SimpleNamespace(ticket=ticket, author=actor)

    activity = activities_services.record_comment_created(fake_comment)

    assert activity.action == Activity.Action.COMMENTED
    assert activity.ticket_id == ticket.id
    assert activity.actor_id == actor.id
    assert activity.from_value is None
    assert activity.to_value is None


# --- take_snapshot: sprint (D8 de esta tanda -- ver 0.8 del resumen) ------


@pytest.mark.django_db
def test_take_snapshot_with_no_sprint_does_not_raise(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor)
    ticket = Ticket.objects.select_related("column").get(id=ticket.id)
    assert not ticket.sprints.exists()

    snapshot = activities_services.take_snapshot(ticket)

    assert snapshot.sprint_ids == frozenset()
    assert snapshot.sprint_label == "Backlog"


@pytest.mark.django_db
def test_take_snapshot_with_sprint_captures_id_and_name(project, backlog, actor, sprint):
    ticket = _create_ticket(project, backlog, actor)
    ticket.sprints.add(sprint)
    ticket = Ticket.objects.select_related("column").get(id=ticket.id)

    snapshot = activities_services.take_snapshot(ticket)

    assert snapshot.sprint_ids == frozenset({sprint.id})
    assert snapshot.sprint_label == sprint.name


# --- record_ticket_changes: sprint_changed ---------------------------------


@pytest.mark.django_db
def test_moving_ticket_into_a_sprint_emits_sprint_changed_from_backlog(project, backlog, actor, sprint):
    ticket = _create_ticket(project, backlog, actor)
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"sprint_ids": [str(sprint.id)]})

    activity = Activity.objects.get(ticket=ticket, action=Activity.Action.SPRINT_CHANGED)
    assert activity.from_value == {"id": None, "ids": [], "label": "Backlog"}
    assert activity.to_value == {"id": None, "ids": [str(sprint.id)], "label": sprint.name}


@pytest.mark.django_db
def test_moving_ticket_back_to_backlog_emits_sprint_changed_to_backlog(project, backlog, actor, sprint):
    ticket = _create_ticket(project, backlog, actor, sprint_ids=[str(sprint.id)])
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"sprint_ids": []})

    activity = Activity.objects.get(ticket=ticket, action=Activity.Action.SPRINT_CHANGED)
    assert activity.from_value == {"id": None, "ids": [str(sprint.id)], "label": sprint.name}
    assert activity.to_value == {"id": None, "ids": [], "label": "Backlog"}


@pytest.mark.django_db
def test_patch_with_same_sprint_emits_nothing(project, backlog, actor, sprint):
    ticket = _create_ticket(project, backlog, actor, sprint_ids=[str(sprint.id)])
    Activity.objects.all().delete()

    _update_ticket(ticket, project, actor, {"sprint_ids": [str(sprint.id)]})

    assert not Activity.objects.filter(ticket=ticket, action=Activity.Action.SPRINT_CHANGED).exists()


@pytest.mark.django_db
def test_changing_sprint_does_not_touch_order(project, backlog, actor, sprint):
    ticket = _create_ticket(project, backlog, actor)
    _create_ticket(project, backlog, actor, title="Otro ticket")
    original_order = Ticket.objects.get(id=ticket.id).order

    _update_ticket(ticket, project, actor, {"sprint_ids": [str(sprint.id)]})

    assert Ticket.objects.get(id=ticket.id).order == original_order


# --- protección: un fallo en el registro de actividad no rompe el PATCH ---


@pytest.mark.django_db
def test_activity_recording_failure_does_not_revert_or_break_the_patch(project, backlog, actor):
    ticket = _create_ticket(project, backlog, actor, title="Original")
    Activity.objects.all().delete()

    with patch.object(activities_services, "record_ticket_changes", side_effect=Exception("boom")):
        updated_ticket = _update_ticket(ticket, project, actor, {"title": "Nuevo titulo"})

    assert updated_ticket.title == "Nuevo titulo"
    assert Ticket.objects.get(id=ticket.id).title == "Nuevo titulo"
