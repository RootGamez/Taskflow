"""Tests HTTP de `Page` (docs/PHASE_4_PLAN.md seccion 4.5, tests 10-43).

Patron `apps/tickets/tests.py:22-48`: login real via `/api/v1/auth/login/`,
`HTTP_AUTHORIZATION=f"Bearer {...}"`, workspace + `WorkspaceMember(is_
active=True)`. `PageAPITestCase` es la base compartida; cada subclase
agrupa un pedazo del contrato (listado, creacion, detalle/patch/delete).
"""

from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from apps.pages.models import Page
from apps.projects.models import Project
from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


def _tiptap_doc(text: str) -> str:
    return json.dumps(
        {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}]}
    )


class PageAPITestCase(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email="owner@example.com",
            full_name="Owner",
            password="Passw0rd!123",
        )
        self._login_as(self.user)

        self.workspace = Workspace.objects.create(name="Producto", owner=self.user)
        WorkspaceMember.objects.create(
            workspace=self.workspace,
            user=self.user,
            role=WorkspaceMember.Role.OWNER,
            is_active=True,
        )
        self.project = Project.objects.create(workspace=self.workspace, name="Core Platform")

    def _login_as(self, user, password: str = "Passw0rd!123") -> None:
        login_response = self.client.post(
            "/api/v1/auth/login/", {"email": user.email, "password": password}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

    def _add_member(self, role: str, email: str) -> User:
        member = User.objects.create_user(email=email, full_name="Miembro", password="Passw0rd!123")
        WorkspaceMember.objects.create(workspace=self.workspace, user=member, role=role, is_active=True)
        return member

    def _create_page(self, **overrides) -> dict:
        payload = {"title": "Pagina base", **overrides}
        response = self.client.post(f"/api/v1/workspaces/{self.workspace.slug}/pages/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def _create_foreign_workspace_with_page(self) -> tuple[Workspace, Page]:
        foreign_owner = User.objects.create_user(
            email="foreign-owner@example.com", full_name="Foreign Owner", password="Passw0rd!123"
        )
        foreign_workspace = Workspace.objects.create(name="Otro Equipo", owner=foreign_owner)
        WorkspaceMember.objects.create(
            workspace=foreign_workspace,
            user=foreign_owner,
            role=WorkspaceMember.Role.OWNER,
            is_active=True,
        )
        foreign_page = Page.objects.create(
            workspace=foreign_workspace,
            title="Secreto ajeno",
            order=1,
            created_by=foreign_owner,
            updated_by=foreign_owner,
        )
        return foreign_workspace, foreign_page


class PageListTests(PageAPITestCase):
    def test_list_pages_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_pages_from_a_foreign_workspace_returns_404(self) -> None:
        foreign_workspace, _foreign_page = self._create_foreign_workspace_with_page()

        response = self.client.get(f"/api/v1/workspaces/{foreign_workspace.slug}/pages/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_pages_excludes_content(self) -> None:
        self._create_page(title="Con contenido", content=_tiptap_doc("dato sensible"))

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("content", response.data[0])

    def test_list_pages_includes_child_count(self) -> None:
        parent = self._create_page(title="Padre")
        self._create_page(title="Hijo 1", parent_id=parent["id"])
        self._create_page(title="Hijo 2", parent_id=parent["id"])

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")

        parent_entry = next(entry for entry in response.data if entry["id"] == parent["id"])
        self.assertEqual(parent_entry["child_count"], 2)

    def test_list_pages_filters_by_q_on_title(self) -> None:
        self._create_page(title="Onboarding del equipo")
        self._create_page(title="Politica de vacaciones")

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/?q=Onboarding")

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Onboarding del equipo")

    def test_list_pages_filters_by_q_on_content_text(self) -> None:
        self._create_page(title="Sin match en titulo", content=_tiptap_doc("palabra clave especial"))
        self._create_page(title="Otra pagina", content=_tiptap_doc("contenido distinto"))

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/?q=especial")

        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "Sin match en titulo")

    def test_list_pages_ignores_a_one_char_q(self) -> None:
        self._create_page(title="Una pagina")
        self._create_page(title="Otra pagina")

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/?q=a")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_list_pages_filters_by_project(self) -> None:
        with_project = self._create_page(title="Con proyecto", project_id=str(self.project.id))
        self._create_page(title="Sin proyecto")

        by_project = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/?project={self.project.id}")
        self.assertEqual([entry["id"] for entry in by_project.data], [with_project["id"]])

        without_project = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/?project=none")
        self.assertEqual(len(without_project.data), 1)
        self.assertNotEqual(without_project.data[0]["id"], with_project["id"])

    def test_list_pages_does_not_scale_queries(self) -> None:
        for i in range(10):
            self._create_page(title=f"Pagina {i}")

        with CaptureQueriesContext(connection) as small_batch:
            response_small = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")
        self.assertEqual(response_small.status_code, status.HTTP_200_OK)

        for i in range(10, 15):
            self._create_page(title=f"Pagina {i}")

        with CaptureQueriesContext(connection) as bigger_batch:
            response_big = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")
        self.assertEqual(response_big.status_code, status.HTTP_200_OK)

        self.assertLessEqual(len(bigger_batch.captured_queries), len(small_batch.captured_queries))


class PageCreateTests(PageAPITestCase):
    def test_create_page_returns_201_with_order_max_plus_one(self) -> None:
        first = self._create_page(title="Primera")
        second = self._create_page(title="Segunda")

        self.assertEqual(Page.objects.get(id=first["id"]).order, 1)
        self.assertEqual(Page.objects.get(id=second["id"]).order, 2)

    def test_create_page_populates_content_text(self) -> None:
        data = self._create_page(content=_tiptap_doc("Hola desde create"))

        self.assertEqual(Page.objects.get(id=data["id"]).content_text, "Hola desde create")

    def test_create_page_with_blank_title_returns_400(self) -> None:
        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/", {"title": "   "}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "El titulo de la pagina es obligatorio.")

    def test_create_page_as_viewer_returns_403(self) -> None:
        viewer = self._add_member(WorkspaceMember.Role.VIEWER, "viewer@example.com")
        self._login_as(viewer)

        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/", {"title": "Intento"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_page_with_a_parent_from_another_workspace_returns_400_without_leaking_its_title(self) -> None:
        _foreign_workspace, foreign_page = self._create_foreign_workspace_with_page()

        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/",
            {"title": "Nueva", "parent_id": str(foreign_page.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Pagina padre no encontrada.")
        self.assertNotIn(foreign_page.title, response.data["detail"])

    def test_create_page_with_a_project_from_another_workspace_returns_400(self) -> None:
        foreign_workspace, _foreign_page = self._create_foreign_workspace_with_page()
        foreign_project = Project.objects.create(workspace=foreign_workspace, name="Proyecto ajeno")

        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/",
            {"title": "Nueva", "project_id": str(foreign_project.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "El proyecto no pertenece a este espacio.")

    def test_create_page_beyond_max_depth_returns_400(self) -> None:
        parent_id = None
        for level in range(5):  # niveles 0..4: 5 niveles totales (D13)
            page = self._create_page(title=f"Nivel {level}", parent_id=parent_id)
            parent_id = page["id"]

        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/",
            {"title": "Nivel 5", "parent_id": parent_id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "No se pueden anidar mas de 5 niveles de paginas.")

    def test_creating_the_501st_page_returns_400(self) -> None:
        Page.objects.bulk_create(
            [
                Page(
                    workspace=self.workspace,
                    title=f"Pagina {i}",
                    order=1,
                    created_by=self.user,
                    updated_by=self.user,
                )
                for i in range(500)
            ]
        )

        response = self.client.post(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/", {"title": "La 501"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Este espacio no puede tener mas de 500 paginas.")


class PageDetailPatchDeleteTests(PageAPITestCase):
    def test_retrieve_page_returns_content_and_breadcrumb(self) -> None:
        root = self._create_page(title="Raiz")
        child = self._create_page(title="Hijo", parent_id=root["id"])
        grandchild = self._create_page(
            title="Nieto", parent_id=child["id"], content=_tiptap_doc("contenido nieto")
        )

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/{grandchild['id']}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("contenido nieto", response.data["content"])
        self.assertEqual(
            response.data["breadcrumb"],
            [
                {"id": root["id"], "title": "Raiz", "icon": ""},
                {"id": child["id"], "title": "Hijo", "icon": ""},
            ],
        )

    def test_retrieve_page_from_another_workspace_returns_404(self) -> None:
        _foreign_workspace, foreign_page = self._create_foreign_workspace_with_page()

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/{foreign_page.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_patch_page_updates_content_and_content_text(self) -> None:
        page = self._create_page()

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"content": _tiptap_doc("Texto actualizado"), "expected_updated_at": page["updated_at"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Texto actualizado", response.data["content"])
        self.assertEqual(Page.objects.get(id=page["id"]).content_text, "Texto actualizado")

    def test_patch_page_with_a_stale_expected_updated_at_returns_409(self) -> None:
        page = self._create_page()
        stale_timestamp = page["updated_at"]

        # Bump de `updated_at` con un rename SIN `expected_updated_at`
        # (permitido por D14 -- ver test_patch_page_without_expected_
        # updated_at_still_renames).
        rename_response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"title": "Renombrada mientras tanto"},
            format="json",
        )
        self.assertEqual(rename_response.status_code, status.HTTP_200_OK)

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"content": _tiptap_doc("Choca con la version"), "expected_updated_at": stale_timestamp},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            response.data["detail"],
            "Esta pagina fue modificada por otra persona. Recarga antes de guardar.",
        )

    def test_patch_page_with_a_fresh_expected_updated_at_succeeds(self) -> None:
        page = self._create_page()

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"content": _tiptap_doc("Al dia"), "expected_updated_at": page["updated_at"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Al dia", response.data["content"])

    def test_patch_page_without_expected_updated_at_still_renames(self) -> None:
        page = self._create_page()

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"title": "Nuevo titulo"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], "Nuevo titulo")

    def test_patch_page_with_content_but_no_expected_updated_at_returns_409(self) -> None:
        """Hallazgo de security-reviewer (Fase 4A): un PATCH que trae
        `content` no puede saltarse el chequeo de concurrencia mandando
        `expected_updated_at`. Sin esto, cualquier cliente HTTP directo
        pisaba el documento de otra persona en silencio."""
        page = self._create_page()

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"content": "{\"type\":\"doc\",\"content\":[]}"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_patch_page_setting_itself_as_parent_returns_400(self) -> None:
        page = self._create_page()

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"parent_id": page["id"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Una pagina no puede ser su propia sub-pagina.")

    def test_patch_page_moving_it_under_its_own_child_returns_400(self) -> None:
        root = self._create_page(title="Raiz")
        child = self._create_page(title="Hijo", parent_id=root["id"])

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{root['id']}/",
            {"parent_id": child["id"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["detail"], "No se puede mover una pagina dentro de una de sus sub-paginas."
        )

    def test_patch_page_as_viewer_returns_403(self) -> None:
        page = self._create_page()
        viewer = self._add_member(WorkspaceMember.Role.VIEWER, "viewer@example.com")
        self._login_as(viewer)

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"title": "Intento"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_page_sets_updated_by(self) -> None:
        page = self._create_page()
        writer = self._add_member(WorkspaceMember.Role.ADMIN, "writer@example.com")
        self._login_as(writer)

        response = self.client.patch(
            f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/",
            {"title": "Editada por otro"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated_by"]["id"], str(writer.id))

    def test_delete_page_returns_204(self) -> None:
        page = self._create_page()

        response = self.client.delete(f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Page.objects.filter(id=page["id"]).exists())

    def test_delete_page_deletes_its_descendants(self) -> None:
        root = self._create_page(title="Raiz")
        child = self._create_page(title="Hijo", parent_id=root["id"])
        grandchild = self._create_page(title="Nieto", parent_id=child["id"])

        response = self.client.delete(f"/api/v1/workspaces/{self.workspace.slug}/pages/{root['id']}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Page.objects.filter(id__in=[child["id"], grandchild["id"]]).count(), 0)

    def test_delete_page_as_viewer_returns_403(self) -> None:
        page = self._create_page()
        viewer = self._add_member(WorkspaceMember.Role.VIEWER, "viewer@example.com")
        self._login_as(viewer)

        response = self.client.delete(f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Page.objects.filter(id=page["id"]).exists())

    def test_deleting_the_project_keeps_its_pages_with_null_project(self) -> None:
        page = self._create_page(project_id=str(self.project.id))

        response = self.client.delete(f"/api/v1/workspaces/{self.workspace.slug}/projects/{self.project.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.assertIsNone(Page.objects.get(id=page["id"]).project_id)

        get_response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/{page['id']}/")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertIsNone(get_response.data["project_id"])

    def test_deleting_the_workspace_deletes_its_pages(self) -> None:
        page = self._create_page()

        response = self.client.delete(f"/api/v1/workspaces/{self.workspace.slug}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Page.objects.filter(id=page["id"]).exists())

    def test_deleting_the_author_keeps_the_page(self) -> None:
        writer = self._add_member(WorkspaceMember.Role.ADMIN, "writer@example.com")
        self._login_as(writer)
        page = self._create_page(title="Escrita por otro")

        User.objects.get(id=writer.id).delete()

        stored = Page.objects.get(id=page["id"])
        self.assertIsNone(stored.created_by_id)


class PageRoutingContractTests(PageAPITestCase):
    """Heredado de WP-0A (docs/PHASE_4_PLAN.md seccion 3.6, test 5): sigue
    vigente ahora que `PageListCreateView` esta wireada de verdad."""

    def test_page_routes_do_not_collide_with_workspace_detail(self) -> None:
        workspace_detail = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/")
        self.assertEqual(workspace_detail.status_code, status.HTTP_200_OK)

        pages_response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")
        self.assertEqual(pages_response.status_code, status.HTTP_200_OK)
