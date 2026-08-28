from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.projects.models import Project, ProjectColumn
from apps.relations.models import TicketRelation
from apps.tickets.models import Ticket
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class TicketRelationFlowTests(APITestCase):
    def setUp(self) -> None:
        self.owner = User.objects.create_user(
            email="owner@example.com", full_name="Owner", password="Passw0rd!123"
        )
        self.member = User.objects.create_user(
            email="member@example.com", full_name="Member", password="Passw0rd!123"
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
            workspace=self.workspace, user=self.viewer, role=WorkspaceMember.Role.VIEWER, is_active=True
        )

        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform", key="TASK")
        self.column = ProjectColumn.objects.create(project=self.project, name="Backlog", order=1)

        self.ticket_a = Ticket.objects.create(
            project=self.project, column=self.column, created_by=self.owner, title="Ticket A", order=1, number=1
        )
        self.ticket_b = Ticket.objects.create(
            project=self.project, column=self.column, created_by=self.owner, title="Ticket B", order=2, number=2
        )
        self.ticket_c = Ticket.objects.create(
            project=self.project, column=self.column, created_by=self.owner, title="Ticket C", order=3, number=3
        )

        # Otro proyecto, mismo workspace (para RC7/D40).
        self.other_project = Project.objects.create(workspace=self.workspace, name="Otro proyecto", key="OTRO")
        self.other_column = ProjectColumn.objects.create(project=self.other_project, name="Backlog", order=1)
        self.foreign_ticket_same_workspace = Ticket.objects.create(
            project=self.other_project,
            column=self.other_column,
            created_by=self.owner,
            title="Ticket de otro proyecto",
            order=1,
        )

        # Otro workspace por completo (para RC7 -- no leak de titulo).
        self.other_workspace = Workspace.objects.create(name="Otro workspace", owner=self.outsider)
        WorkspaceMember.objects.create(
            workspace=self.other_workspace, user=self.outsider, role=WorkspaceMember.Role.OWNER, is_active=True
        )
        self.foreign_project_other_workspace = Project.objects.create(
            workspace=self.other_workspace, name="Proyecto secreto del otro workspace"
        )
        self.foreign_column_other_workspace = ProjectColumn.objects.create(
            project=self.foreign_project_other_workspace, name="Backlog", order=1
        )
        self.foreign_ticket_other_workspace = Ticket.objects.create(
            project=self.foreign_project_other_workspace,
            column=self.foreign_column_other_workspace,
            created_by=self.outsider,
            title="Titulo secreto que no deberia filtrarse",
            order=1,
        )

    def _login(self, email: str) -> None:
        response = self.client.post(
            "/api/v1/auth/login/", {"email": email, "password": "Passw0rd!123"}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def _relations_url(self, project=None, ticket=None) -> str:
        project = project or self.project
        ticket = ticket or self.ticket_a
        return f"/api/v1/projects/{project.id}/tickets/{ticket.id}/relations/"

    def _relation_detail_url(self, relation_id, project=None, ticket=None) -> str:
        project = project or self.project
        ticket = ticket or self.ticket_a
        return f"/api/v1/projects/{project.id}/tickets/{ticket.id}/relations/{relation_id}/"

    def _create_relation(self, ticket, other_ticket, relation_type, author_email="owner@example.com"):
        self._login(author_email)
        return self.client.post(
            self._relations_url(ticket=ticket),
            {"relation_type": relation_type, "ticket_id": str(other_ticket.id)},
            format="json",
        )

    # -- Listado --------------------------------------------------------

    def test_list_relations_requires_authentication(self) -> None:
        response = self.client.get(self._relations_url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_relations_from_a_foreign_workspace_returns_404(self) -> None:
        self._login(self.outsider.email)
        response = self.client.get(self._relations_url())

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_relations_includes_outgoing_and_incoming(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks")
        self._create_relation(self.ticket_c, self.ticket_a, "relates_to")

        self._login(self.member.email)
        response = self.client.get(self._relations_url(ticket=self.ticket_a))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        directions = {row["direction"] for row in response.data}
        self.assertEqual(directions, {"outgoing", "incoming"})

    def test_list_relations_always_returns_the_other_ticket(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks")

        self._login(self.member.email)

        response_from_a = self.client.get(self._relations_url(ticket=self.ticket_a))
        self.assertEqual(response_from_a.data[0]["ticket"]["id"], str(self.ticket_b.id))
        self.assertEqual(response_from_a.data[0]["relation_type"], "blocks")

        response_from_b = self.client.get(self._relations_url(ticket=self.ticket_b))
        self.assertEqual(response_from_b.data[0]["ticket"]["id"], str(self.ticket_a.id))
        self.assertEqual(response_from_b.data[0]["relation_type"], "blocked_by")

    def test_list_relations_includes_reference_and_column_name(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks")

        self._login(self.member.email)
        response = self.client.get(self._relations_url(ticket=self.ticket_a))

        row = response.data[0]
        self.assertEqual(row["ticket"]["reference"], "TASK-2")
        self.assertEqual(row["ticket"]["column_name"], "Backlog")

    def test_list_relations_does_not_scale_queries(self) -> None:
        other_tickets = [
            Ticket.objects.create(
                project=self.project,
                column=self.column,
                created_by=self.owner,
                title=f"Ticket extra {index}",
                order=10 + index,
                number=10 + index,
            )
            for index in range(10)
        ]
        for other in other_tickets:
            TicketRelation.objects.create(from_ticket=self.ticket_a, to_ticket=other, relation_type="relates_to")

        self._login(self.member.email)
        with self.assertNumQueries(5):
            response = self.client.get(self._relations_url(ticket=self.ticket_a))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 10)

    # -- Creacion ---------------------------------------------------------

    def test_create_blocks_returns_201(self) -> None:
        response = self._create_relation(self.ticket_a, self.ticket_b, "blocks", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["relation_type"], "blocks")
        self.assertEqual(response.data["stored_type"], "blocks")
        self.assertEqual(response.data["direction"], "outgoing")
        self.assertEqual(response.data["ticket"]["id"], str(self.ticket_b.id))

    def test_create_blocked_by_stores_the_inverse_row(self) -> None:
        response = self._create_relation(self.ticket_a, self.ticket_b, "blocked_by", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["relation_type"], "blocked_by")
        self.assertEqual(response.data["stored_type"], "blocks")
        self.assertEqual(response.data["direction"], "incoming")

        relation = TicketRelation.objects.get()
        self.assertEqual(relation.from_ticket_id, self.ticket_b.id)
        self.assertEqual(relation.to_ticket_id, self.ticket_a.id)
        self.assertEqual(relation.relation_type, "blocks")

    def test_create_self_relation_returns_400(self) -> None:
        response = self._create_relation(self.ticket_a, self.ticket_a, "relates_to", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Un ticket no puede relacionarse consigo mismo.")

    def test_create_relation_to_a_ticket_in_another_project_returns_400(self) -> None:
        response = self._create_relation(
            self.ticket_a, self.foreign_ticket_same_workspace, "relates_to", self.member.email
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Solo se pueden relacionar tickets del mismo proyecto.")

    def test_create_relation_to_a_ticket_in_another_workspace_does_not_leak_its_title(self) -> None:
        response = self._create_relation(
            self.ticket_a, self.foreign_ticket_other_workspace, "relates_to", self.member.email
        )

        self.assertIn(response.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND))
        body = str(response.data)
        self.assertNotIn("Titulo secreto que no deberia filtrarse", body)
        self.assertNotIn(self.foreign_project_other_workspace.name, body)

    def test_create_duplicate_relation_returns_400_not_500(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "relates_to", self.member.email)

        response = self._create_relation(self.ticket_a, self.ticket_b, "relates_to", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Esa relacion ya existe.")

    def test_create_reciprocal_blocks_returns_400(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks", self.member.email)

        response = self._create_relation(self.ticket_b, self.ticket_a, "blocks", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "TASK-1 ya bloquea a este ticket.")

    def test_create_reciprocal_duplicate_of_returns_400(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "duplicate_of", self.member.email)

        response = self._create_relation(self.ticket_b, self.ticket_a, "duplicate_of", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "TASK-1 ya es un duplicado de este ticket.")

    def test_create_mirrored_relates_to_returns_400(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "relates_to", self.member.email)

        response = self._create_relation(self.ticket_b, self.ticket_a, "relates_to", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Esa relacion ya existe.")

    def test_transitive_cycle_is_allowed_in_v1(self) -> None:
        # Documenta el comportamiento actual (RC3/D42): A->B->C->A no se
        # detecta ni se rechaza en v1. Si esto empieza a fallar, es porque
        # alguien agrego deteccion de ciclos transitivos -- un cambio que
        # debe ser deliberado, no un efecto secundario.
        first = self._create_relation(self.ticket_a, self.ticket_b, "blocks", self.member.email)
        second = self._create_relation(self.ticket_b, self.ticket_c, "blocks", self.member.email)
        third = self._create_relation(self.ticket_c, self.ticket_a, "blocks", self.member.email)

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(third.status_code, status.HTTP_201_CREATED)

    def test_create_relation_as_viewer_returns_403(self) -> None:
        response = self._create_relation(self.ticket_a, self.ticket_b, "relates_to", self.viewer.email)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creating_the_51st_relation_returns_400(self) -> None:
        others = [
            Ticket.objects.create(
                project=self.project,
                column=self.column,
                created_by=self.owner,
                title=f"Ticket relleno {index}",
                order=100 + index,
            )
            for index in range(50)
        ]
        for other in others:
            TicketRelation.objects.create(from_ticket=self.ticket_a, to_ticket=other, relation_type="relates_to")

        extra_ticket = Ticket.objects.create(
            project=self.project, column=self.column, created_by=self.owner, title="Ticket 51", order=999
        )
        response = self._create_relation(self.ticket_a, extra_ticket, "relates_to", self.member.email)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Un ticket no puede tener mas de 50 relaciones.")

    # -- Borrado --------------------------------------------------------

    def test_delete_relation_returns_204(self) -> None:
        create_response = self._create_relation(self.ticket_a, self.ticket_b, "relates_to", self.member.email)
        relation_id = create_response.data["id"]

        response = self.client.delete(self._relation_detail_url(relation_id, ticket=self.ticket_a))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TicketRelation.objects.filter(id=relation_id).exists())

    def test_delete_an_incoming_relation_from_the_target_ticket(self) -> None:
        # D44/RC8: "Bloqueado por" es una fila entrante (`to_ticket=A`).
        # Borrarla DESDE el ticket A (el que la muestra) tiene que
        # funcionar -- no solo desde el ticket B que la origino.
        create_response = self._create_relation(self.ticket_a, self.ticket_b, "blocked_by", self.member.email)
        relation_id = create_response.data["id"]

        response = self.client.delete(self._relation_detail_url(relation_id, ticket=self.ticket_a))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TicketRelation.objects.filter(id=relation_id).exists())

    def test_delete_relation_of_another_ticket_returns_404(self) -> None:
        create_response = self._create_relation(self.ticket_b, self.ticket_c, "relates_to", self.member.email)
        relation_id = create_response.data["id"]

        # ticket_a no es ninguno de los dos extremos de esta relacion.
        response = self.client.delete(self._relation_detail_url(relation_id, ticket=self.ticket_a))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(TicketRelation.objects.filter(id=relation_id).exists())

    def test_delete_relation_as_viewer_returns_403(self) -> None:
        create_response = self._create_relation(self.ticket_a, self.ticket_b, "relates_to", self.member.email)
        relation_id = create_response.data["id"]

        self._login(self.viewer.email)
        response = self.client.delete(self._relation_detail_url(relation_id, ticket=self.ticket_a))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(TicketRelation.objects.filter(id=relation_id).exists())

    # -- Cascada (RC1) ----------------------------------------------------

    def test_deleting_the_from_ticket_deletes_the_relation(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks", self.member.email)
        self.assertEqual(TicketRelation.objects.count(), 1)

        self.ticket_a.delete()

        self.assertEqual(TicketRelation.objects.count(), 0)

    def test_deleting_the_to_ticket_deletes_the_relation(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks", self.member.email)
        self.assertEqual(TicketRelation.objects.count(), 1)

        self.ticket_b.delete()

        self.assertEqual(TicketRelation.objects.count(), 0)

    def test_deleting_a_related_ticket_does_not_delete_the_other_one(self) -> None:
        self._create_relation(self.ticket_a, self.ticket_b, "blocks", self.member.email)

        self.ticket_a.delete()

        self.assertTrue(Ticket.objects.filter(id=self.ticket_b.id).exists())
