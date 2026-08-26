from __future__ import annotations

from django.test import TestCase

from apps.labels.models import Label
from apps.labels.palette import LABEL_COLORS
from apps.labels.serializers import LabelCreateSerializer, LabelSerializer, LabelUpdateSerializer
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from django.contrib.auth import get_user_model

User = get_user_model()


class LabelCreateSerializerTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")

    def test_create_serializer_accepts_a_palette_color(self) -> None:
        serializer = LabelCreateSerializer(
            data={"name": "Bug", "color": LABEL_COLORS[0]},
            context={"project": self.project},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_create_serializer_rejects_a_non_palette_hex(self) -> None:
        serializer = LabelCreateSerializer(
            data={"name": "Bug", "color": "#123456"},
            context={"project": self.project},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("color", serializer.errors)

    def test_create_serializer_normalizes_lowercase_hex_to_uppercase(self) -> None:
        serializer = LabelCreateSerializer(
            data={"name": "Bug", "color": LABEL_COLORS[0].lower()},
            context={"project": self.project},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["color"], LABEL_COLORS[0])

    def test_create_serializer_rejects_empty_color(self) -> None:
        serializer = LabelCreateSerializer(
            data={"name": "Bug", "color": ""},
            context={"project": self.project},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("color", serializer.errors)

    def test_create_serializer_rejects_blank_name(self) -> None:
        serializer = LabelCreateSerializer(
            data={"name": "   ", "color": LABEL_COLORS[0]},
            context={"project": self.project},
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("name", serializer.errors)

    def test_create_serializer_strips_whitespace_from_name(self) -> None:
        serializer = LabelCreateSerializer(
            data={"name": "  Bug  ", "color": LABEL_COLORS[0]},
            context={"project": self.project},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["name"], "Bug")

    def test_create_serializer_rejects_duplicate_name_case_insensitively(self) -> None:
        Label.objects.create(project=self.project, name="Bug", color=LABEL_COLORS[0])

        serializer = LabelCreateSerializer(
            data={"name": "  bug  ", "color": LABEL_COLORS[1]},
            context={"project": self.project},
        )

        self.assertFalse(serializer.is_valid())

    def test_create_serializer_allows_same_name_in_a_different_project(self) -> None:
        Label.objects.create(project=self.other_project, name="Bug", color=LABEL_COLORS[0])

        serializer = LabelCreateSerializer(
            data={"name": "Bug", "color": LABEL_COLORS[1]},
            context={"project": self.project},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


class LabelUpdateSerializerTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.label = Label.objects.create(project=self.project, name="Bug", color=LABEL_COLORS[0])

    def test_update_serializer_excludes_itself_from_the_uniqueness_check(self) -> None:
        serializer = LabelUpdateSerializer(
            self.label,
            data={"name": "Bug", "color": LABEL_COLORS[1]},
            context={"project": self.project},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


class LabelSerializerContractTests(TestCase):
    def test_label_serializer_fields_are_unchanged(self) -> None:
        # Congela el contrato consumido por `apps.tickets.serializers.TicketSerializer`
        # (D37): si esto falla, alguien modifico `LabelSerializer.Meta.fields`.
        self.assertEqual(
            LabelSerializer.Meta.fields,
            ("id", "project_id", "name", "color", "created_at"),
        )


class LabelPaletteFrozenTests(TestCase):
    def test_palette_tuple_is_frozen(self) -> None:
        self.assertEqual(
            LABEL_COLORS,
            (
                "#2563EB",
                "#16A34A",
                "#0891B2",
                "#EA580C",
                "#9333EA",
                "#DC2626",
                "#64748B",
                "#0F766E",
                "#DB2777",
                "#CA8A04",
            ),
        )
