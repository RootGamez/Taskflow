"""Vistas de adjuntos del editor (Fase 2 del repotenciado de Tiptap).

Dos superficies, un solo flujo:

- `POST   /api/v1/projects/<project_id>/tickets/<ticket_id>/attachments/`
- `POST   /api/v1/workspaces/<workspace_slug>/pages/<page_id>/attachments/`
- `GET    .../attachments/<attachment_id>/download/` -> 302 a la URL firmada
- `DELETE .../attachments/<attachment_id>/`

El scoping replica el de las vistas que ya existen: tickets pasan por
`get_project_for_user` + `assert_project_write_access`
(apps/tickets/views.py), y paginas por
`assert_workspace_write_access` (apps/pages/views.py). En ambos casos el
`attachment_id` se busca SIEMPRE acotado a su dueno ya autorizado, nunca
por id suelto -- un UUID valido de otro workspace da 404, no 403.
"""

from __future__ import annotations

from django.shortcuts import redirect
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.attachments.models import Attachment
from apps.attachments.serializers import AttachmentSerializer
from apps.attachments.storage import build_presigned_url, upload_attachment
from apps.pages.models import Page
from apps.tickets.models import Ticket
from apps.workspaces.access import WorkspaceRoleAccessMixin

UPLOAD_FIELD = "file"


def _create_attachment(request: Request, *, scope: str, owner_id: str, **owner_kwargs) -> Response:
    """Valida, sube y persiste. Compartido por las dos superficies."""
    upload = request.FILES.get(UPLOAD_FIELD)
    if upload is None:
        raise ValidationError({"detail": f"Debes adjuntar un campo '{UPLOAD_FIELD}'."})

    try:
        object_key, content_type, checksum, file_size = upload_attachment(
            upload, scope=scope, owner_id=owner_id
        )
    except ValueError as exc:
        raise ValidationError({"detail": str(exc)}) from exc
    except Exception as exc:  # fallo de MinIO, red, credenciales...
        raise ValidationError({"detail": "No se pudo subir el archivo."}) from exc

    attachment = Attachment.objects.create(
        uploaded_by=request.user,
        object_key=object_key,
        file_name=upload.name or "",
        content_type=content_type,
        file_size=file_size,
        checksum=checksum,
        **owner_kwargs,
    )

    return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)


class TicketAttachmentView(WorkspaceRoleAccessMixin, APIView):
    """Adjuntos de un ticket.

    POST   /api/v1/projects/<project_id>/tickets/<ticket_id>/attachments/
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _get_ticket(self, request: Request, project_id: str, ticket_id: str) -> Ticket:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        ticket = project.tickets.filter(id=ticket_id).first()
        if ticket is None:
            raise NotFound("Ticket no encontrado.")
        return ticket

    def post(self, request: Request, project_id: str, ticket_id: str) -> Response:
        ticket = self._get_ticket(request, project_id, ticket_id)
        return _create_attachment(
            request, scope="tickets", owner_id=str(ticket.id), ticket=ticket
        )


class TicketAttachmentDetailView(WorkspaceRoleAccessMixin, APIView):
    """Descarga y borrado de un adjunto de ticket."""

    permission_classes = [IsAuthenticated]

    def _get_attachment(
        self, request: Request, project_id: str, ticket_id: str, attachment_id: str
    ) -> Attachment:
        project = self.get_project_for_user(request, project_id)
        self.assert_project_write_access(request, project)
        # Acotado al ticket, que a su vez esta acotado al proyecto del
        # usuario: un id de otro workspace nunca matchea.
        attachment = Attachment.objects.filter(
            id=attachment_id, ticket_id=ticket_id, ticket__project=project
        ).first()
        if attachment is None:
            raise NotFound("Adjunto no encontrado.")
        return attachment

    def get(
        self, request: Request, project_id: str, ticket_id: str, attachment_id: str
    ) -> Response:
        attachment = self._get_attachment(request, project_id, ticket_id, attachment_id)
        return redirect(build_presigned_url(attachment.object_key, attachment.file_name))

    def delete(
        self, request: Request, project_id: str, ticket_id: str, attachment_id: str
    ) -> Response:
        attachment = self._get_attachment(request, project_id, ticket_id, attachment_id)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PageAttachmentView(WorkspaceRoleAccessMixin, APIView):
    """Adjuntos de una pagina de documentacion.

    POST /api/v1/workspaces/<workspace_slug>/pages/<page_id>/attachments/
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _get_page(self, request: Request, workspace_slug: str, page_id: str) -> Page:
        # `assert_workspace_write_access` recibe el slug y DEVUELVE el
        # workspace ya autorizado (a diferencia de su hermana de proyecto,
        # que recibe el objeto). Mismo uso que apps/pages/views.py:110.
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        page = workspace.pages.filter(id=page_id).first()
        if page is None:
            raise NotFound("Pagina no encontrada.")
        return page

    def post(self, request: Request, workspace_slug: str, page_id: str) -> Response:
        page = self._get_page(request, workspace_slug, page_id)
        return _create_attachment(request, scope="pages", owner_id=str(page.id), page=page)


class PageAttachmentDetailView(WorkspaceRoleAccessMixin, APIView):
    """Descarga y borrado de un adjunto de pagina."""

    permission_classes = [IsAuthenticated]

    def _get_attachment(
        self, request: Request, workspace_slug: str, page_id: str, attachment_id: str
    ) -> Attachment:
        workspace = self.assert_workspace_write_access(request, workspace_slug)
        attachment = Attachment.objects.filter(
            id=attachment_id, page_id=page_id, page__workspace=workspace
        ).first()
        if attachment is None:
            raise NotFound("Adjunto no encontrado.")
        return attachment

    def get(
        self, request: Request, workspace_slug: str, page_id: str, attachment_id: str
    ) -> Response:
        attachment = self._get_attachment(request, workspace_slug, page_id, attachment_id)
        return redirect(build_presigned_url(attachment.object_key, attachment.file_name))

    def delete(
        self, request: Request, workspace_slug: str, page_id: str, attachment_id: str
    ) -> Response:
        attachment = self._get_attachment(request, workspace_slug, page_id, attachment_id)
        attachment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
