from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.workspaces.models import Workspace, WorkspaceMember

User = get_user_model()


class PageRoutingContractTests(APITestCase):
    """WP-0A (docs/PHASE_4_PLAN.md seccion 3.6, tests 5-6).

    `apps/pages/urls.py` sale de WP-0A con `urlpatterns = []` a proposito
    (WP-P lo rellena en la Ola 1, seccion 4). Estos dos tests documentan
    el contrato de ruteo ANTES de que exista `PageListCreateView`:

    - la URL reservada para paginas (`workspaces/<slug>/pages/`) no cae,
      por error, en ningun patron de `apps/workspaces/urls.py` (R0A-1);
    - un cliente sin sesion nunca ve un 200 con datos en esa URL, ni hoy
      (404, porque la ruta todavia no existe) ni cuando WP-P la
      implemente (401, por `IsAuthenticated`).

    Se reemplazan por las versiones definitivas de WP-P
    (`test_list_pages_requires_authentication`, `test_list_pages_from_a_
    foreign_workspace_returns_404`, etc., docs/PHASE_4_PLAN.md seccion
    4.5) en cuanto `PageListCreateView` quede wireada.
    """

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

    def test_page_routes_do_not_collide_with_workspace_detail(self) -> None:
        # El converter `slug` de Django no cruza "/": "workspaces/<slug>/"
        # (WorkspaceDetailView) NO matchea "workspaces/<slug>/pages/".
        # Confirmamos primero que el detalle del workspace SI responde
        # 200 (el patron esta vivo), y despues que la ruta de paginas no
        # queda accidentalmente capturada por ese mismo patron.
        workspace_detail = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/")
        self.assertEqual(workspace_detail.status_code, status.HTTP_200_OK)

        pages_response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")
        self.assertEqual(pages_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_pages_list_requires_authentication(self) -> None:
        self.client.credentials()

        response = self.client.get(f"/api/v1/workspaces/{self.workspace.slug}/pages/")

        self.assertNotEqual(response.status_code, status.HTTP_200_OK)
