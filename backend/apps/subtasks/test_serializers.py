from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.projects.models import Project, ProjectColumn
from apps.subtasks.models import SubTask
from apps.subtasks.serializers import SubTaskCreateSerializer, SubTaskUpdateSerializer
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class SubTaskSerializerTestBase(TestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Ticket base",
            order=1,
        )


class SubTaskCreateSerializerTests(SubTaskSerializerTestBase):
    def test_create_serializer_strips_whitespace_from_title(self) -> None:
        serializer = SubTaskCreateSerializer(
            data={"title": "  Escribir los tests  "}, context={"project": self.project}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["title"], "Escribir los tests")

    def test_create_serializer_rejects_blank_title(self) -> None:
        serializer = SubTaskCreateSerializer(data={"title": "   "}, context={"project": self.project})

        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_create_serializer_rejects_a_title_over_255_chars(self) -> None:
        serializer = SubTaskCreateSerializer(
            data={"title": "x" * 256}, context={"project": self.project}
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("title", serializer.errors)

    def test_create_serializer_ignores_client_supplied_order(self) -> None:
        serializer = SubTaskCreateSerializer(
            data={"title": "Titulo", "order": 999}, context={"project": self.project}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("order", serializer.validated_data)

    def test_create_serializer_ignores_client_supplied_is_done(self) -> None:
        serializer = SubTaskCreateSerializer(
            data={"title": "Titulo", "is_done": True}, context={"project": self.project}
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("is_done", serializer.validated_data)

    def test_create_serializer_rejects_an_assignee_outside_the_workspace(self) -> None:
        outsider = User.objects.create_user(
            email="outsider@example.com", full_name="Outsider", password="Passw0rd!123"
        )

        serializer = SubTaskCreateSerializer(
            data={"title": "Titulo", "assignee_id": str(outsider.id)},
            context={"project": self.project},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("assignee_id", serializer.errors)

    def test_create_serializer_accepts_an_assignee_from_the_workspace(self) -> None:
        member = User.objects.create_user(
            email="member@example.com", full_name="Member", password="Passw0rd!123"
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=member, role=WorkspaceMember.Role.MEMBER, is_active=True
        )

        serializer = SubTaskCreateSerializer(
            data={"title": "Titulo", "assignee_id": str(member.id)},
            context={"project": self.project},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(str(serializer.validated_data["assignee_id"]), str(member.id))


class SubTaskUpdateSerializerTests(SubTaskSerializerTestBase):
    def test_update_serializer_sets_completed_at_when_marking_done(self) -> None:
        subtask = SubTask.objects.create(ticket=self.ticket, title="Subtarea", order=1)

        serializer = SubTaskUpdateSerializer(
            subtask, data={"is_done": True}, context={"project": self.project}, partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        self.assertTrue(updated.is_done)
        self.assertIsNotNone(updated.completed_at)

    def test_update_serializer_clears_completed_at_when_unmarking(self) -> None:
        subtask = SubTask.objects.create(
            ticket=self.ticket, title="Subtarea", order=1, is_done=True, completed_at=timezone.now()
        )

        serializer = SubTaskUpdateSerializer(
            subtask, data={"is_done": False}, context={"project": self.project}, partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        self.assertFalse(updated.is_done)
        self.assertIsNone(updated.completed_at)

    def test_update_serializer_is_idempotent_when_is_done_does_not_change(self) -> None:
        subtask = SubTask.objects.create(ticket=self.ticket, title="Subtarea", order=1, is_done=False)

        serializer = SubTaskUpdateSerializer(
            subtask, data={"is_done": False}, context={"project": self.project}, partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        self.assertFalse(updated.is_done)
        self.assertIsNone(updated.completed_at)

    def test_update_serializer_ignores_client_supplied_completed_at(self) -> None:
        subtask = SubTask.objects.create(ticket=self.ticket, title="Subtarea", order=1)

        serializer = SubTaskUpdateSerializer(
            subtask,
            data={"title": "Nuevo titulo", "completed_at": "2020-01-01T00:00:00Z"},
            context={"project": self.project},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()

        self.assertEqual(updated.title, "Nuevo titulo")
        self.assertIsNone(updated.completed_at)
