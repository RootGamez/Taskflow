from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
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
