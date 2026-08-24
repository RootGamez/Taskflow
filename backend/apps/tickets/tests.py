from __future__ import annotations

from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class TicketFlowTests(APITestCase):
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
		self.project = Project.objects.create(
			workspace=self.workspace,
			name="Core Platform",
		)
		self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
		self.progress = ProjectColumn.objects.create(project=self.project, name="En progreso", order=2)

	def test_create_ticket_and_move_between_columns_persists_order(self) -> None:
		create_1 = self.client.post(
			f"/api/v1/projects/{self.project.id}/tickets/",
			{
				"title": "Primer ticket",
				"priority": "high",
				"column_id": str(self.backlog.id),
			},
			format="json",
		)
		create_2 = self.client.post(
			f"/api/v1/projects/{self.project.id}/tickets/",
			{
				"title": "Segundo ticket",
				"priority": "medium",
				"column_id": str(self.backlog.id),
			},
			format="json",
		)

		self.assertEqual(create_1.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_2.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_1.data["order"], 1)
		self.assertEqual(create_2.data["order"], 2)

		move_response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{create_1.data['id']}/",
			{
				"column_id": str(self.progress.id),
				"order": 1,
			},
			format="json",
		)
		self.assertEqual(move_response.status_code, status.HTTP_200_OK)
		self.assertEqual(move_response.data["column_id"], str(self.progress.id))
		self.assertEqual(move_response.data["order"], 1)

		list_response = self.client.get(f"/api/v1/projects/{self.project.id}/tickets/")
		self.assertEqual(list_response.status_code, status.HTTP_200_OK)

		backlog_tickets = [ticket for ticket in list_response.data if ticket["column_id"] == str(self.backlog.id)]
		progress_tickets = [ticket for ticket in list_response.data if ticket["column_id"] == str(self.progress.id)]

		self.assertEqual(len(backlog_tickets), 1)
		self.assertEqual(backlog_tickets[0]["title"], "Segundo ticket")
		self.assertEqual(backlog_tickets[0]["order"], 1)
		self.assertEqual(len(progress_tickets), 1)
		self.assertEqual(progress_tickets[0]["title"], "Primer ticket")
		self.assertEqual(progress_tickets[0]["order"], 1)

	def test_viewer_cannot_update_ticket(self) -> None:
		create_response = self.client.post(
			f"/api/v1/projects/{self.project.id}/tickets/",
			{"title": "Ticket base", "column_id": str(self.backlog.id)},
			format="json",
		)
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

		viewer = User.objects.create_user(
			email="viewer@example.com",
			full_name="Viewer",
			password="Passw0rd!123",
		)
		WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=viewer,
			role=WorkspaceMember.Role.VIEWER,
			is_active=False,
		)

		viewer_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": "viewer@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {viewer_login.data['access']}")

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{create_response.data['id']}/",
			{"priority": "urgent"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_admin_can_create_ticket(self) -> None:
		admin = User.objects.create_user(
			email="admin@example.com",
			full_name="Admin",
			password="Passw0rd!123",
		)
		WorkspaceMember.objects.create(
			workspace=self.workspace,
			user=admin,
			role=WorkspaceMember.Role.ADMIN,
			is_active=False,
		)

		admin_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": "admin@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_login.data['access']}")

		response = self.client.post(
			f"/api/v1/projects/{self.project.id}/tickets/",
			{"title": "Ticket admin", "column_id": str(self.backlog.id)},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class TicketDateFilterTests(APITestCase):
	FROZEN_NOW = datetime(2025, 3, 10, 12, 0, 0, tzinfo=dt_timezone.utc)

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
		self.project = Project.objects.create(
			workspace=self.workspace,
			name="Core Platform",
		)
		self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
		self.progress = ProjectColumn.objects.create(project=self.project, name="En progreso", order=2)

		now_patcher = patch("django.utils.timezone.now", return_value=self.FROZEN_NOW)
		self.mock_now = now_patcher.start()
		self.addCleanup(now_patcher.stop)

		self.overdue_ticket = Ticket.objects.create(
			project=self.project,
			column=self.backlog,
			created_by=self.user,
			title="Vencido",
			order=1,
			due_date=self.FROZEN_NOW - timedelta(days=1),
		)
		self.due_today_ticket = Ticket.objects.create(
			project=self.project,
			column=self.backlog,
			created_by=self.user,
			title="Vence hoy",
			order=2,
			due_date=self.FROZEN_NOW,
		)
		self.due_soon_ticket = Ticket.objects.create(
			project=self.project,
			column=self.backlog,
			created_by=self.user,
			title="Vence en 10 dias",
			order=3,
			due_date=self.FROZEN_NOW + timedelta(days=10),
		)
		self.no_due_date_ticket = Ticket.objects.create(
			project=self.project,
			column=self.backlog,
			created_by=self.user,
			title="Sin fecha",
			order=4,
			due_date=None,
		)

	def _list(self, params: dict | None = None):
		return self.client.get(f"/api/v1/projects/{self.project.id}/tickets/", params or {})

	def _ids(self, response) -> list[str]:
		return [ticket["id"] for ticket in response.data]

	def test_without_query_params_returns_all_tickets(self) -> None:
		response = self._list()

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 4)
		self.assertEqual(
			set(self._ids(response)),
			{
				str(self.overdue_ticket.id),
				str(self.due_today_ticket.id),
				str(self.due_soon_ticket.id),
				str(self.no_due_date_ticket.id),
			},
		)

	def test_overdue_true_returns_only_overdue_ticket(self) -> None:
		response = self._list({"overdue": "true"})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(self._ids(response), [str(self.overdue_ticket.id)])

	def test_no_due_date_true_returns_only_ticket_without_due_date(self) -> None:
		response = self._list({"no_due_date": "true"})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(self._ids(response), [str(self.no_due_date_ticket.id)])

	def test_due_after_filters_inclusively_from_start_of_day(self) -> None:
		due_after = self.FROZEN_NOW.date().isoformat()

		response = self._list({"due_after": due_after})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(
			set(self._ids(response)),
			{str(self.due_today_ticket.id), str(self.due_soon_ticket.id)},
		)

	def test_due_before_includes_tickets_due_later_the_same_day(self) -> None:
		due_before = self.FROZEN_NOW.date().isoformat()

		response = self._list({"due_before": due_before})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(
			set(self._ids(response)),
			{str(self.overdue_ticket.id), str(self.due_today_ticket.id)},
		)

	def test_due_after_and_due_before_combined_narrow_the_range(self) -> None:
		due_after = self.FROZEN_NOW.date().isoformat()
		due_before = (self.FROZEN_NOW + timedelta(days=5)).date().isoformat()

		response = self._list({"due_after": due_after, "due_before": due_before})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(self._ids(response), [str(self.due_today_ticket.id)])

	def test_malformed_date_returns_400_not_500(self) -> None:
		response = self._list({"due_after": "not-a-date"})

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("detail", response.data)

	def test_overdue_and_no_due_date_together_returns_400(self) -> None:
		response = self._list({"overdue": "true", "no_due_date": "true"})

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("detail", response.data)

	def test_preserves_order_by_column_order_then_order_then_created_at(self) -> None:
		progress_ticket = Ticket.objects.create(
			project=self.project,
			column=self.progress,
			created_by=self.user,
			title="En progreso con fecha",
			order=1,
			due_date=self.FROZEN_NOW + timedelta(days=2),
		)

		due_after = self.FROZEN_NOW.date().isoformat()
		response = self._list({"due_after": due_after})

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(
			self._ids(response),
			[str(self.due_today_ticket.id), str(self.due_soon_ticket.id), str(progress_ticket.id)],
		)

	def test_user_without_membership_receives_404_even_with_filters(self) -> None:
		stranger = User.objects.create_user(
			email="stranger@example.com",
			full_name="Stranger",
			password="Passw0rd!123",
		)
		stranger_login = self.client.post(
			"/api/v1/auth/login/",
			{"email": "stranger@example.com", "password": "Passw0rd!123"},
			format="json",
		)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {stranger_login.data['access']}")

		response = self._list({"overdue": "true"})

		self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
