"""Vistas de `Page` (docs/PHASE_4_PLAN.md seccion 4.2).

Workspace-scoped: `WorkspaceRoleAccessMixin.get_workspace_for_user` /
`assert_workspace_write_access` (D5, ya disponibles sin tocar
`apps/workspaces`). Doble scoping contra RP-6: toda busqueda de una
pagina puntual pasa primero por el workspace del usuario autenticado y
recien despues por el `page_id` -- un UUID valido de otro workspace
nunca llega a matchear `_get_page_or_404` y siempre da 404, nunca 200 ni
403.
"""

from __future__ import annotations

from django.db.models import Count, Q, QuerySet
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.fields import DateTimeField
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.pages.models import Page
from apps.pages.serializers import PageCreateSerializer, PageDetailSerializer, PageSummarySerializer, PageUpdateSerializer
from apps.workspaces.access import WorkspaceRoleAccessMixin
from apps.workspaces.models import Workspace

_DATETIME_FIELD = DateTimeField()


def _raise_first_validation_error(errors: dict, fallback: str) -> None:
    first_error = next(iter(errors.values()), None)
    message = str(first_error[0]) if isinstance(first_error, list) and first_error else fallback
    raise ValidationError({"detail": message})


def _annotated_pages_queryset(workspace: Workspace) -> QuerySet[Page]:
    # `select_related` + `annotate` (no conteo en Python, RP-10): listar
    # 500 paginas no debe escalar en cantidad de queries.
    return (
        workspace.pages.select_related("updated_by", "created_by", "project")
        .annotate(child_count=Count("children"))
    )


def _get_page_or_404(workspace: Workspace, page_id: str) -> Page:
    page = _annotated_pages_queryset(workspace).filter(id=page_id).first()
    if page is None:
        raise NotFound("Pagina no encontrada.")
    return page


def _check_concurrency(request: Request, page: Page) -> Response | None:
    """D14: concurrencia optimista, resuelta ANTES del serializer de
    escritura. Un PATCH sin `expected_updated_at` no verifica nada (permite
    renombrar/mover sin haber leido primero) -- solo se activa cuando la
    clave viene en el payload.

    Excepcion de seguridad (hallazgo de security-reviewer, Fase 4A): un
    PATCH que trae `content` SIEMPRE tiene que traer `expected_updated_at`.
    Sin esto, el 409 era una convencion que solo respetaba el frontend --
    un cliente HTTP directo podia pisar el contenido de otra persona en
    silencio, exactamente lo que D14 dice evitar. Renombrar/mover sigue
    sin requerirlo (no hay contenido que perder)."""
    raw = request.data.get("expected_updated_at")
    if not raw:
        if "content" in request.data:
            return Response(
                {"detail": "Esta pagina fue modificada por otra persona. Recarga antes de guardar."},
                status=status.HTTP_409_CONFLICT,
            )
        return None

    try:
        expected = _DATETIME_FIELD.to_internal_value(raw)
    except ValidationError:
        expected = None

    if expected != page.updated_at:
        return Response(
            {"detail": "Esta pagina fue modificada por otra persona. Recarga antes de guardar."},
            status=status.HTTP_409_CONFLICT,
        )

    return None


class PageListCreateView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, workspace_slug: str) -> Response:
        workspace = self.get_workspace_for_user(request, workspace_slug)
        pages = _annotated_pages_queryset(workspace)

        # D16 de Fase 3 (heredado literal): `< 2` chars tras `.strip()` se
        # ignora silenciosamente -- nunca 400.
        q = request.query_params.get("q", "").strip()
        if len(q) >= 2:
            pages = pages.filter(Q(title__icontains=q) | Q(content_text__icontains=q))

        project_param = request.query_params.get("project")
        if project_param == "none":
            pages = pages.filter(project__isnull=True)
        elif project_param:
            pages = pages.filter(project_id=project_param)

        return Response(PageSummarySerializer(pages, many=True).data, status=status.HTTP_200_OK)

    def post(self, request: Request, workspace_slug: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)

        serializer = PageCreateSerializer(
            data=request.data, context={"workspace": workspace, "user": request.user}
        )
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo crear la pagina.")

        page = serializer.save()
        page = _get_page_or_404(workspace, str(page.id))
        return Response(
            PageDetailSerializer(page, context={"workspace": workspace}).data,
            status=status.HTTP_201_CREATED,
        )


class PageDetailView(WorkspaceRoleAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, workspace_slug: str, page_id: str) -> Response:
        workspace = self.get_workspace_for_user(request, workspace_slug)
        page = _get_page_or_404(workspace, page_id)
        return Response(PageDetailSerializer(page, context={"workspace": workspace}).data)

    def patch(self, request: Request, workspace_slug: str, page_id: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        page = _get_page_or_404(workspace, page_id)

        conflict_response = _check_concurrency(request, page)
        if conflict_response is not None:
            return conflict_response

        serializer = PageUpdateSerializer(
            page,
            data=request.data,
            context={"workspace": workspace, "user": request.user},
            partial=True,
        )
        if not serializer.is_valid():
            _raise_first_validation_error(serializer.errors, "No se pudo actualizar la pagina.")

        page = serializer.save()
        page = _get_page_or_404(workspace, str(page.id))
        return Response(PageDetailSerializer(page, context={"workspace": workspace}).data)

    def delete(self, request: Request, workspace_slug: str, page_id: str) -> Response:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        page = _get_page_or_404(workspace, page_id)

        # D17: `parent = CASCADE` borra el subarbol completo.
        page.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
