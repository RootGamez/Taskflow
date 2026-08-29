from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.test import APITestCase

from apps.goals.models import WeeklyBoard, WeeklyGoalItem
from apps.goals.services import current_week_start
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()

PASSWORD = "Passw0rd!123"


class WeeklyBoardApiTestCase(APITestCase):
    """Base compartida: un espacio con un miembro de cada rol
    (OWNER/ADMIN/MEMBER/VIEWER), owner autenticado por defecto."""

    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password=PASSWORD
        )
        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.owner,
            role=WorkspaceMember.Role.OWNER,
            is_active=True,
        )
        self.admin = self._member("admin@example.com", WorkspaceMember.Role.ADMIN)
        self.member = self._member("member@example.com", WorkspaceMember.Role.MEMBER)
        self.viewer = self._member("viewer@example.com", WorkspaceMember.Role.VIEWER)

        self.monday = current_week_start()
        self._login("owner@example.com")

    def _member(self, email: str, role: str) -> User:
        user = User.objects.create_user(
            email=email, full_name=email.split("@")[0].title(), password=PASSWORD
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=user, role=role, is_active=True
        )
        return user

    def _login(self, email: str, password: str = PASSWORD) -> None:
        response = self.client.post(
            "/api/v1/auth/login/", {"email": email, "password": password}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def _url(self, suffix: str = "") -> str:
        return f"/api/v1/workspaces/{self.workspace.slug}/weekly-board/{suffix}"

    def _create_item(self, text: str = "Meta inicial") -> dict:
        return self.client.post(self._url("items/"), {"text": text}, format="json").data


class WeeklyBoardGetTests(WeeklyBoardApiTestCase):
    def test_get_autocreates_empty_board_for_current_week(self) -> None:
        self.assertFalse(WeeklyBoard.objects.exists())

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["week_start"], str(self.monday))
        self.assertEqual(list(response.data["items"]), [])
        self.assertEqual(WeeklyBoard.objects.count(), 1)

    def test_get_is_idempotent_on_second_call(self) -> None:
        first = self.client.get(self._url())
        second = self.client.get(self._url())

        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(WeeklyBoard.objects.count(), 1)

    def test_get_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_from_foreign_workspace_returns_404(self) -> None:
        User.objects.create_user(
            email="stranger@example.com", full_name="Stranger", password=PASSWORD
        )
        self._login("stranger@example.com")

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_can_manage_is_true_for_owner_and_admin(self) -> None:
        for email in ("owner@example.com", "admin@example.com"):
            self._login(email)
            response = self.client.get(self._url())
            self.assertTrue(response.data["can_manage"], msg=email)

    def test_can_manage_is_false_for_member_and_viewer(self) -> None:
        for email in ("member@example.com", "viewer@example.com"):
            self._login(email)
            response = self.client.get(self._url())
            self.assertFalse(response.data["can_manage"], msg=email)

    def test_get_returns_items_nested_and_ordered(self) -> None:
        self._create_item("Primera")
        self._create_item("Segunda")

        response = self.client.get(self._url())

        self.assertEqual(
            [item["text"] for item in response.data["items"]], ["Primera", "Segunda"]
        )
        self.assertEqual([item["order"] for item in response.data["items"]], [1, 2])


class WeeklyGoalItemCreateTests(WeeklyBoardApiTestCase):
    def test_owner_can_create_item_returns_201(self) -> None:
        response = self.client.post(self._url("items/"), {"text": "Cerrar Q3"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["text"], "Cerrar Q3")
        self.assertEqual(response.data["order"], 1)
        self.assertFalse(response.data["is_done"])
        self.assertIsNone(response.data["completed_by"])
        self.assertIsNone(response.data["completed_at"])

    def test_admin_can_create_item_returns_201(self) -> None:
        self._login("admin@example.com")

        response = self.client.post(self._url("items/"), {"text": "Meta admin"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_member_cannot_create_item_returns_403(self) -> None:
        self._login("member@example.com")

        response = self.client.post(self._url("items/"), {"text": "Meta"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(WeeklyGoalItem.objects.exists())

    def test_viewer_cannot_create_item_returns_403(self) -> None:
        self._login("viewer@example.com")

        response = self.client.post(self._url("items/"), {"text": "Meta"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_member_cannot_create_item_returns_404(self) -> None:
        User.objects.create_user(
            email="stranger@example.com", full_name="Stranger", password=PASSWORD
        )
        self._login("stranger@example.com")

        response = self.client.post(self._url("items/"), {"text": "Meta"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_blank_text_returns_400(self) -> None:
        response = self.client.post(self._url("items/"), {"text": "   "}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_order_is_assigned_incrementally_server_side(self) -> None:
        for expected_order in (1, 2, 3):
            response = self.client.post(
                self._url("items/"), {"text": f"Meta {expected_order}"}, format="json"
            )
            self.assertEqual(response.data["order"], expected_order)

    def test_client_supplied_order_is_ignored(self) -> None:
        response = self.client.post(
            self._url("items/"), {"text": "Meta", "order": 99}, format="json"
        )

        self.assertEqual(response.data["order"], 1)


class WeeklyGoalItemPatchTests(WeeklyBoardApiTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.item_id = self._create_item("Meta inicial")["id"]

    def _item_url(self, item_id: str | None = None) -> str:
        return self._url(f"items/{item_id or self.item_id}/")

    def test_member_can_check_is_done_and_it_records_completion(self) -> None:
        self._login("member@example.com")

        response = self.client.patch(self._item_url(), {"is_done": True}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_done"])
        self.assertEqual(response.data["completed_by"]["email"], "member@example.com")
        self.assertIsNotNone(response.data["completed_at"])

    def test_viewer_can_check_is_done(self) -> None:
        self._login("viewer@example.com")

        response = self.client.patch(self._item_url(), {"is_done": True}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_unchecking_is_done_clears_completion(self) -> None:
        self._login("member@example.com")
        self.client.patch(self._item_url(), {"is_done": True}, format="json")

        response = self.client.patch(self._item_url(), {"is_done": False}, format="json")

        self.assertFalse(response.data["is_done"])
        self.assertIsNone(response.data["completed_by"])
        self.assertIsNone(response.data["completed_at"])
        item = WeeklyGoalItem.objects.get(id=self.item_id)
        self.assertIsNone(item.completed_by)
        self.assertIsNone(item.completed_at)

    def test_member_cannot_edit_text_returns_403(self) -> None:
        self._login("member@example.com")

        response = self.client.patch(self._item_url(), {"text": "Reescrita"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(WeeklyGoalItem.objects.get(id=self.item_id).text, "Meta inicial")

    def test_member_cannot_smuggle_text_alongside_is_done(self) -> None:
        self._login("member@example.com")

        response = self.client.patch(
            self._item_url(), {"text": "Reescrita", "is_done": True}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_edit_text_returns_200(self) -> None:
        self._login("admin@example.com")

        response = self.client.patch(self._item_url(), {"text": "Meta renombrada"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["text"], "Meta renombrada")

    def test_admin_can_reorder_item(self) -> None:
        self._login("admin@example.com")

        response = self.client.patch(self._item_url(), {"order": 5}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["order"], 5)

    def test_member_cannot_reorder_item_returns_403(self) -> None:
        self._login("member@example.com")

        response = self.client.patch(self._item_url(), {"order": 5}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_unknown_item_returns_404(self) -> None:
        response = self.client.patch(
            self._url("items/00000000-0000-0000-0000-000000000000/"),
            {"is_done": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_item_from_foreign_workspace_returns_404(self) -> None:
        User.objects.create_user(
            email="stranger@example.com", full_name="Stranger", password=PASSWORD
        )
        self._login("stranger@example.com")

        response = self.client.patch(self._item_url(), {"is_done": True}, format="json")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class WeeklyGoalItemDeleteTests(WeeklyBoardApiTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.item_id = self._create_item("Meta")["id"]

    def _item_url(self) -> str:
        return self._url(f"items/{self.item_id}/")

    def test_admin_can_delete_item_returns_204(self) -> None:
        self._login("admin@example.com")

        response = self.client.delete(self._item_url())

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(WeeklyGoalItem.objects.filter(id=self.item_id).exists())

    def test_member_cannot_delete_item_returns_403(self) -> None:
        self._login("member@example.com")

        response = self.client.delete(self._item_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(WeeklyGoalItem.objects.filter(id=self.item_id).exists())

    def test_viewer_cannot_delete_item_returns_403(self) -> None:
        self._login("viewer@example.com")

        response = self.client.delete(self._item_url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class WeeklyBoardConstraintTests(WeeklyBoardApiTestCase):
    def test_only_one_board_per_workspace_and_week(self) -> None:
        WeeklyBoard.objects.create(
            workspace=self.workspace, week_start=self.monday, created_by=self.owner
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                WeeklyBoard.objects.create(
                    workspace=self.workspace, week_start=self.monday, created_by=self.owner
                )

    def test_same_week_in_a_different_workspace_is_allowed(self) -> None:
        other_workspace = Workspace.objects.create(name="Otro", owner=self.owner)

        WeeklyBoard.objects.create(workspace=self.workspace, week_start=self.monday)
        WeeklyBoard.objects.create(workspace=other_workspace, week_start=self.monday)

        self.assertEqual(WeeklyBoard.objects.filter(week_start=self.monday).count(), 2)


class GoalsMigrationTests(APITestCase):
    def test_models_have_no_pending_migrations(self) -> None:
        # Misma verificacion automatizada que `apps/labels/tests.py`: el estado
        # de los modelos de `goals` debe estar completamente capturado por sus
        # migraciones en disco.
        manage_py = Path(__file__).resolve().parents[2] / "manage.py"
        result = subprocess.run(
            [sys.executable, str(manage_py), "makemigrations", "goals", "--check", "--dry-run"],
            capture_output=True,
            text=True,
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
