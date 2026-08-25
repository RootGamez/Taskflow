from __future__ import annotations

from django.test import TestCase

from apps.projects.backfill import backfill_project_keys
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from django.contrib.auth import get_user_model

User = get_user_model()


class BackfillProjectKeysTests(TestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        self.other_workspace = Workspace.objects.create(name="Otro", owner=self.owner)

    def _make_legacy_project(self, workspace: Workspace, name: str) -> Project:
        """Simula un proyecto 'legacy' como estaria hoy en produccion: creado
        (lo que via `save()` normal dejaria `key=None` porque el campo tiene
        default null) y forzado explicitamente a `key=None` via `.update()`
        para no depender de que el default del campo siga siendo null en el
        futuro.
        """
        project = Project.objects.create(workspace=workspace, name=name)
        Project.objects.filter(id=project.id).update(key=None)
        project.refresh_from_db()
        return project

    def test_assigns_key_to_legacy_projects(self) -> None:
        project = self._make_legacy_project(self.workspace, "Task Flow App")

        updated_count = backfill_project_keys(Project)

        project.refresh_from_db()
        self.assertEqual(updated_count, 1)
        self.assertEqual(project.key, "TFA")

    def test_does_not_touch_projects_that_already_have_a_key(self) -> None:
        project = Project.objects.create(workspace=self.workspace, name="Ya tiene key")
        Project.objects.filter(id=project.id).update(key="CUSTOM")

        updated_count = backfill_project_keys(Project)

        project.refresh_from_db()
        self.assertEqual(updated_count, 0)
        self.assertEqual(project.key, "CUSTOM")

    def test_idempotent_second_run_changes_nothing(self) -> None:
        self._make_legacy_project(self.workspace, "Task Flow App")
        self._make_legacy_project(self.workspace, "Task Flow Beta")

        first_run = backfill_project_keys(Project)
        keys_after_first_run = list(
            Project.objects.filter(workspace=self.workspace).order_by("created_at").values_list("key", flat=True)
        )

        second_run = backfill_project_keys(Project)
        keys_after_second_run = list(
            Project.objects.filter(workspace=self.workspace).order_by("created_at").values_list("key", flat=True)
        )

        self.assertGreater(first_run, 0)
        self.assertEqual(second_run, 0)
        self.assertEqual(keys_after_first_run, keys_after_second_run)

    def test_different_workspaces_can_share_the_same_derived_key(self) -> None:
        project_a = self._make_legacy_project(self.workspace, "Task Flow App")
        project_b = self._make_legacy_project(self.other_workspace, "Task Flow App")

        backfill_project_keys(Project)

        project_a.refresh_from_db()
        project_b.refresh_from_db()
        self.assertEqual(project_a.key, "TFA")
        self.assertEqual(project_b.key, "TFA")

    def test_same_workspace_projects_never_end_up_with_the_same_key(self) -> None:
        project_a = self._make_legacy_project(self.workspace, "Task Flow App")
        project_b = self._make_legacy_project(self.workspace, "Task Flow Alpha")
        project_c = self._make_legacy_project(self.workspace, "Task Flow Alt")

        backfill_project_keys(Project)

        project_a.refresh_from_db()
        project_b.refresh_from_db()
        project_c.refresh_from_db()
        keys = {project_a.key, project_b.key, project_c.key}
        self.assertEqual(len(keys), 3)

    def test_backfill_only_changes_key_field_nothing_else(self) -> None:
        project = self._make_legacy_project(self.workspace, "Task Flow App")
        original_name = project.name
        original_color = project.color
        original_description = project.description
        original_is_archived = project.is_archived

        backfill_project_keys(Project)

        project.refresh_from_db()
        self.assertEqual(project.name, original_name)
        self.assertEqual(project.color, original_color)
        self.assertEqual(project.description, original_description)
        self.assertEqual(project.is_archived, original_is_archived)
        self.assertIsNotNone(project.key)
