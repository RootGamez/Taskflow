from __future__ import annotations

import json
from datetime import date, datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework import status
from rest_framework.test import APITestCase

from apps.activities.models import Activity
from apps.labels.models import Label
from apps.projects.models import Project, ProjectColumn
from apps.relations.models import TicketRelation
from apps.sprints.models import Sprint
from apps.subtasks.models import SubTask
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


class TicketSprintLabelReferenceTests(APITestCase):
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
		self.project = Project.objects.create(workspace=self.workspace, name="Core Platform", key="KEY")
		self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
		self.sprint = Sprint.objects.create(
			project=self.project,
			name="Sprint 1",
			start_date=date(2026, 1, 1),
			end_date=date(2026, 1, 14),
		)
		self.label = Label.objects.create(project=self.project, name="Bug", color="#DC2626")

		self.other_workspace = Workspace.objects.create(name="Otro", owner=self.user)
		WorkspaceMember.objects.create(
			workspace=self.other_workspace,
			user=self.user,
			role=WorkspaceMember.Role.OWNER,
			is_active=True,
		)
		self.other_project = Project.objects.create(workspace=self.other_workspace, name="Otro proyecto")
		ProjectColumn.objects.create(project=self.other_project, name="Backlog", order=1)
		self.other_sprint = Sprint.objects.create(
			project=self.other_project,
			name="Sprint ajeno",
			start_date=date(2026, 1, 1),
			end_date=date(2026, 1, 14),
		)
		self.other_label = Label.objects.create(project=self.other_project, name="Ajena", color="#2563EB")

	def _create_ticket(self, **overrides) -> dict:
		payload = {"title": "Ticket base", "column_id": str(self.backlog.id), **overrides}
		response = self.client.post(f"/api/v1/projects/{self.project.id}/tickets/", payload, format="json")
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		return response.data

	def test_reference_uses_project_key_and_ticket_number(self) -> None:
		ticket = self._create_ticket()

		self.assertEqual(ticket["reference"], "KEY-1")
		self.assertEqual(ticket["number"], 1)

	def test_reference_is_null_when_project_has_no_key(self) -> None:
		project_without_key = Project.objects.create(workspace=self.workspace, name="Sin key")
		Project.objects.filter(id=project_without_key.id).update(key=None)
		column = ProjectColumn.objects.create(project=project_without_key, name="Backlog", order=1)

		response = self.client.post(
			f"/api/v1/projects/{project_without_key.id}/tickets/",
			{"title": "Ticket sin key", "column_id": str(column.id)},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertIsNone(response.data["reference"])

	def test_patch_sprint_id_moves_ticket_and_records_sprint_changed_activity(self) -> None:
		ticket = self._create_ticket()

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket['id']}/",
			{"sprint_id": str(self.sprint.id)},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["sprint_id"], str(self.sprint.id))
		self.assertTrue(
			Activity.objects.filter(
				ticket_id=ticket["id"],
				action=Activity.Action.SPRINT_CHANGED,
			).exists()
		)

	def test_patch_sprint_id_null_sends_ticket_back_to_backlog(self) -> None:
		ticket = self._create_ticket(sprint_id=str(self.sprint.id))

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket['id']}/",
			{"sprint_id": None},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIsNone(response.data["sprint_id"])

	def test_sprint_from_another_project_returns_400(self) -> None:
		ticket = self._create_ticket()

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket['id']}/",
			{"sprint_id": str(self.other_sprint.id)},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_changing_sprint_does_not_alter_order(self) -> None:
		ticket = self._create_ticket()
		self._create_ticket(title="Segundo ticket")
		order_before = Ticket.objects.get(id=ticket["id"]).order

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket['id']}/",
			{"sprint_id": str(self.sprint.id)},
			format="json",
		)

		order_after = Ticket.objects.get(id=ticket["id"]).order
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(order_before, order_after)

	def test_label_ids_from_another_project_returns_400(self) -> None:
		ticket = self._create_ticket()

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket['id']}/",
			{"label_ids": [str(self.other_label.id)]},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_create_with_label_ids_from_another_project_returns_400(self) -> None:
		response = self.client.post(
			f"/api/v1/projects/{self.project.id}/tickets/",
			{
				"title": "Ticket con label ajena",
				"column_id": str(self.backlog.id),
				"label_ids": [str(self.other_label.id)],
			},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_listing_tickets_with_many_labels_does_not_scale_queries(self) -> None:
		extra_labels = [
			Label.objects.create(project=self.project, name=f"Label {i}", color="#2563EB") for i in range(5)
		]
		for i in range(20):
			ticket_id = self._create_ticket(title=f"Ticket {i}")["id"]
			ticket = Ticket.objects.get(id=ticket_id)
			ticket.labels.set(extra_labels)

		with CaptureQueriesContext(connection) as small_batch:
			response_small = self.client.get(f"/api/v1/projects/{self.project.id}/tickets/")
		self.assertEqual(response_small.status_code, status.HTTP_200_OK)

		for i in range(20, 25):
			ticket_id = self._create_ticket(title=f"Ticket {i}")["id"]
			ticket = Ticket.objects.get(id=ticket_id)
			ticket.labels.set(extra_labels)

		with CaptureQueriesContext(connection) as bigger_batch:
			response_big = self.client.get(f"/api/v1/projects/{self.project.id}/tickets/")
		self.assertEqual(response_big.status_code, status.HTTP_200_OK)

		# El listado no debe escalar linealmente con la cantidad de tickets
		# ni de labels por ticket (anti N+1, seccion 0.9): la cantidad de
		# queries con 25 tickets no debe ser mayor que con 20.
		self.assertLessEqual(len(bigger_batch.captured_queries), len(small_batch.captured_queries))


class TicketSubtaskCountersAndDescriptionTextTests(APITestCase):
	"""WP-0 (Fase 3): contadores de subtareas en el serializer (D12) +
	`description_text` calculado en create/update (D9/D11)."""

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
		self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
		self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

	def _create_ticket(self, **overrides) -> dict:
		payload = {"title": "Ticket base", "column_id": str(self.backlog.id), **overrides}
		response = self.client.post(f"/api/v1/projects/{self.project.id}/tickets/", payload, format="json")
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		return response.data

	def test_ticket_serializer_exposes_subtask_counts_as_zero_when_none(self) -> None:
		ticket = self._create_ticket()

		self.assertEqual(ticket["subtask_count"], 0)
		self.assertEqual(ticket["completed_subtask_count"], 0)

	def test_ticket_serializer_counts_only_done_subtasks_as_completed(self) -> None:
		ticket_data = self._create_ticket()
		ticket = Ticket.objects.get(id=ticket_data["id"])
		SubTask.objects.create(ticket=ticket, title="Uno", is_done=True, order=1)
		SubTask.objects.create(ticket=ticket, title="Dos", is_done=False, order=2)
		SubTask.objects.create(ticket=ticket, title="Tres", is_done=True, order=3)

		response = self.client.get(f"/api/v1/tickets/{ticket.id}/")

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["subtask_count"], 3)
		self.assertEqual(response.data["completed_subtask_count"], 2)

	def test_creating_a_ticket_populates_description_text(self) -> None:
		doc = json.dumps(
			{
				"type": "doc",
				"content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hola desde create"}]}],
			}
		)

		ticket_data = self._create_ticket(description=doc)

		ticket = Ticket.objects.get(id=ticket_data["id"])
		self.assertEqual(ticket.description_text, "Hola desde create")

	def test_patching_description_updates_description_text(self) -> None:
		ticket_data = self._create_ticket()
		doc = json.dumps(
			{
				"type": "doc",
				"content": [{"type": "paragraph", "content": [{"type": "text", "text": "Texto actualizado"}]}],
			}
		)

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket_data['id']}/",
			{"description": doc},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		ticket = Ticket.objects.get(id=ticket_data["id"])
		self.assertEqual(ticket.description_text, "Texto actualizado")

	def test_patching_only_the_title_does_not_touch_description_text(self) -> None:
		doc = json.dumps(
			{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Original"}]}]}
		)
		ticket_data = self._create_ticket(description=doc)
		ticket = Ticket.objects.get(id=ticket_data["id"])
		self.assertEqual(ticket.description_text, "Original")

		response = self.client.patch(
			f"/api/v1/projects/{self.project.id}/tickets/{ticket_data['id']}/",
			{"title": "Nuevo titulo"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		ticket.refresh_from_db()
		self.assertEqual(ticket.description_text, "Original")
		self.assertEqual(ticket.title, "Nuevo titulo")

	def test_listing_tickets_with_subtasks_does_not_scale_queries(self) -> None:
		for i in range(5):
			ticket_id = self._create_ticket(title=f"Ticket {i}")["id"]
			ticket = Ticket.objects.get(id=ticket_id)
			for j in range(4):
				SubTask.objects.create(ticket=ticket, title=f"Subtarea {j}", order=j + 1)

		with CaptureQueriesContext(connection) as small_batch:
			response_small = self.client.get(f"/api/v1/projects/{self.project.id}/tickets/")
		self.assertEqual(response_small.status_code, status.HTTP_200_OK)

		for i in range(5, 10):
			ticket_id = self._create_ticket(title=f"Ticket {i}")["id"]
			ticket = Ticket.objects.get(id=ticket_id)
			for j in range(4):
				SubTask.objects.create(ticket=ticket, title=f"Subtarea {j}", order=j + 1)

		with CaptureQueriesContext(connection) as bigger_batch:
			response_big = self.client.get(f"/api/v1/projects/{self.project.id}/tickets/")
		self.assertEqual(response_big.status_code, status.HTTP_200_OK)

		# Anti N+1 (R0-5/D12): la cantidad de queries con 10 tickets x 4
		# subtareas no debe ser mayor que con 5 tickets x 4 subtareas.
		self.assertLessEqual(len(bigger_batch.captured_queries), len(small_batch.captured_queries))


class TicketCascadeDeletionTests(APITestCase):
	"""WP-0 (Fase 3): borrar un ticket borra sus subtareas y relaciones en
	ambas direcciones (`on_delete=CASCADE`, RB1/RC1)."""

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
		self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
		self.backlog = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

	def _create_ticket(self, title: str) -> Ticket:
		response = self.client.post(
			f"/api/v1/projects/{self.project.id}/tickets/",
			{"title": title, "column_id": str(self.backlog.id)},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
		return Ticket.objects.get(id=response.data["id"])

	def test_deleting_a_ticket_deletes_its_subtasks(self) -> None:
		ticket = self._create_ticket("Con subtareas")
		SubTask.objects.create(ticket=ticket, title="Sobrevive", order=1)
		SubTask.objects.create(ticket=ticket, title="Tambien", order=2)

		response = self.client.delete(f"/api/v1/projects/{self.project.id}/tickets/{ticket.id}/")

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertEqual(SubTask.objects.filter(ticket_id=ticket.id).count(), 0)

	def test_deleting_a_ticket_deletes_its_relations_in_both_directions(self) -> None:
		blocker = self._create_ticket("Bloqueador")
		blocked = self._create_ticket("Bloqueado")
		other = self._create_ticket("Otro")

		relation_outgoing = TicketRelation.objects.create(
			from_ticket=blocker,
			to_ticket=blocked,
			relation_type=TicketRelation.Type.BLOCKS,
			created_by=self.user,
		)
		relation_incoming = TicketRelation.objects.create(
			from_ticket=other,
			to_ticket=blocker,
			relation_type=TicketRelation.Type.RELATES_TO,
			created_by=self.user,
		)

		response = self.client.delete(f"/api/v1/projects/{self.project.id}/tickets/{blocker.id}/")

		self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
		self.assertFalse(TicketRelation.objects.filter(id=relation_outgoing.id).exists())
		self.assertFalse(TicketRelation.objects.filter(id=relation_incoming.id).exists())
		# El otro extremo de cada relacion (el ticket, no la fila de
		# relacion) no se borra en cascada -- solo se borro `blocker`.
		self.assertTrue(Ticket.objects.filter(id=blocked.id).exists())
		self.assertTrue(Ticket.objects.filter(id=other.id).exists())
