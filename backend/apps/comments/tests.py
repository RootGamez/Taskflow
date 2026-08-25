from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.comments.models import Comment
from apps.notifications.models import Notification
from apps.projects.models import Project, ProjectColumn
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class CommentFlowTests(APITestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.member = User.objects.create_user(
            email="member@example.com", full_name="Member", password="Passw0rd!123"
        )
        self.other_member = User.objects.create_user(
            email="other-member@example.com", full_name="Other Member", password="Passw0rd!123"
        )
        self.admin = User.objects.create_user(
            email="admin@example.com", full_name="Admin", password="Passw0rd!123"
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com", full_name="Viewer", password="Passw0rd!123"
        )
        self.outsider = User.objects.create_user(
            email="outsider@example.com", full_name="Outsider", password="Passw0rd!123"
        )

        self.workspace = Workspace.objects.create(name="Producto", owner=self.owner)
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.owner, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.member, role=WorkspaceMember.Role.MEMBER, is_active=True
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.other_member,
            role=WorkspaceMember.Role.MEMBER,
            is_active=True,
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.admin, role=WorkspaceMember.Role.ADMIN, is_active=True
        )
        WorkspaceMember.objects.create(
            workspace=self.workspace, user=self.viewer, role=WorkspaceMember.Role.VIEWER, is_active=True
        )

        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)
        self.ticket = Ticket.objects.create(
            project=self.project,
            column=self.column,
            created_by=self.owner,
            title="Arreglar login",
            order=1,
        )
        self.ticket.assignees.set([self.member])

        # Workspace/proyecto/ticket ajenos, para los casos 404.
        self.other_workspace = Workspace.objects.create(name="Otro workspace", owner=self.outsider)
        WorkspaceMember.objects.create(
            workspace=self.other_workspace,
            user=self.outsider,
            role=WorkspaceMember.Role.OWNER,
            is_active=True,
        )
        self.foreign_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto")
        self.foreign_column = ProjectColumn.objects.create(
            project=self.foreign_project, name="Backlog", order=1
        )
        self.foreign_ticket = Ticket.objects.create(
            project=self.foreign_project,
            column=self.foreign_column,
            created_by=self.owner,
            title="Ticket de otro proyecto",
            order=1,
        )

    def _login(self, email: str) -> None:
        response = self.client.post(
            "/api/v1/auth/login/", {"email": email, "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def _comments_url(self, project=None, ticket=None) -> str:
        project = project or self.project
        ticket = ticket or self.ticket
        return f"/api/v1/projects/{project.id}/tickets/{ticket.id}/comments/"

    def _comment_detail_url(self, comment_id, project=None, ticket=None) -> str:
        project = project or self.project
        ticket = ticket or self.ticket
        return f"/api/v1/projects/{project.id}/tickets/{ticket.id}/comments/{comment_id}/"

    def _create_comment(self, author_email: str, body: str = "Hola equipo", mention_user_ids=None):
        self._login(author_email)
        payload = {"body": body}
        if mention_user_ids is not None:
            payload["mention_user_ids"] = mention_user_ids
        return self.client.post(self._comments_url(), payload, format="json")

    # -- Listado --------------------------------------------------------

    def test_member_lists_comments_of_own_ticket(self) -> None:
        self._create_comment(self.owner.email, "Primer comentario")

        self._login(self.member.email)
        response = self.client.get(self._comments_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["body"], "Primer comentario")

    def test_user_from_other_workspace_gets_404_not_403(self) -> None:
        self._login(self.outsider.email)
        response = self.client.get(self._comments_url())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_viewer_can_read_comments(self) -> None:
        self._create_comment(self.owner.email)

        self._login(self.viewer.email)
        response = self.client.get(self._comments_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_ticket_from_another_project_returns_404(self) -> None:
        self._login(self.owner.email)
        response = self.client.get(self._comments_url(ticket=self.foreign_ticket))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_listing_uses_a_constant_number_of_queries(self) -> None:
        for index in range(10):
            self._create_comment(self.owner.email, f"Comentario {index}")

        self._login(self.member.email)
        with self.assertNumQueries(6):
            response = self.client.get(self._comments_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 10)

    # -- Creación ---------------------------------------------------------

    def test_viewer_cannot_create_comment(self) -> None:
        self._login(self.viewer.email)
        response = self.client.post(self._comments_url(), {"body": "No debería poder"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_can_create_comment(self) -> None:
        response = self._create_comment(self.member.email, "Hola desde member")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["body"], "Hola desde member")
        self.assertEqual(response.data["author"]["id"], str(self.member.id))
        self.assertIsNone(response.data["edited_at"])

    def test_create_comment_on_ticket_from_another_project_returns_404(self) -> None:
        self._login(self.owner.email)
        response = self.client.post(
            self._comments_url(ticket=self.foreign_ticket), {"body": "hola"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -- Edición ------------------------------------------------------------

    def test_author_can_edit_own_comment(self) -> None:
        create_response = self._create_comment(self.member.email, "Version original")
        comment_id = create_response.data["id"]

        response = self.client.patch(
            self._comment_detail_url(comment_id), {"body": "Version editada"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["body"], "Version editada")
        self.assertIsNotNone(response.data["edited_at"])

    def test_non_author_cannot_edit_even_if_admin(self) -> None:
        create_response = self._create_comment(self.member.email, "Version original")
        comment_id = create_response.data["id"]

        self._login(self.admin.email)
        response = self.client.patch(
            self._comment_detail_url(comment_id), {"body": "Intento ajeno"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -- Borrado --------------------------------------------------------

    def test_author_deletes_own_comment_soft_deletes_and_hides_from_list(self) -> None:
        create_response = self._create_comment(self.member.email, "Para borrar")
        comment_id = create_response.data["id"]

        delete_response = self.client.delete(self._comment_detail_url(comment_id))
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

        list_response = self.client.get(self._comments_url())
        self.assertEqual(list_response.data, [])

        comment = Comment.objects.get(id=comment_id)
        self.assertIsNotNone(comment.deleted_at)
        self.assertEqual(comment.body, "Para borrar")

    def test_admin_can_delete_others_comment(self) -> None:
        create_response = self._create_comment(self.member.email, "Comentario de member")
        comment_id = create_response.data["id"]

        self._login(self.admin.email)
        response = self.client.delete(self._comment_detail_url(comment_id))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_regular_member_cannot_delete_others_comment(self) -> None:
        create_response = self._create_comment(self.member.email, "Comentario de member")
        comment_id = create_response.data["id"]

        self._login(self.other_member.email)
        response = self.client.delete(self._comment_detail_url(comment_id))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -- Notificaciones ---------------------------------------------------

    def test_create_comment_triggers_expected_notifications(self) -> None:
        # El ticket fue creado por owner y asignado a member; other_member
        # comenta primero para volverse "seguidor".
        self._create_comment(self.other_member.email, "Primer comentario, sin mencion")
        Notification.objects.all().delete()

        response = self._create_comment(
            self.member.email, f"Gracias @{self.admin.full_name}", mention_user_ids=[str(self.admin.id)]
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        mention_notifications = Notification.objects.filter(
            recipient=self.admin, notification_type=Notification.Type.TICKET_MENTIONED
        )
        self.assertEqual(mention_notifications.count(), 1)

        commented_recipients = set(
            Notification.objects.filter(notification_type=Notification.Type.TICKET_COMMENTED).values_list(
                "recipient_id", flat=True
            )
        )
        # owner (creador) y other_member (comentó antes) son seguidores;
        # member (autor del comentario actual) no se autonotifica.
        self.assertEqual(commented_recipients, {self.owner.id, self.other_member.id})
        self.assertNotIn(self.member.id, commented_recipients)
