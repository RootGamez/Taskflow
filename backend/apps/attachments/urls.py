"""Rutas de adjuntos del editor (Fase 2 del repotenciado de Tiptap).

Incluido bajo "api/v1/" en config/urls.py, igual que apps.tickets y
apps.pages. Las rutas cuelgan del ticket o de la pagina a proposito: no
hay endpoint global "/attachments/<id>/" porque eso obligaria a resolver
el permiso a partir del propio adjunto, y un id filtrado bastaria para
intentar la descarga. Con el dueno en la URL, el scoping se comprueba
antes de tocar el adjunto.
"""

from __future__ import annotations

from django.urls import path

from apps.attachments.views import (
    PageAttachmentDetailView,
    PageAttachmentView,
    TicketAttachmentDetailView,
    TicketAttachmentView,
)

urlpatterns = [
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/attachments/",
        TicketAttachmentView.as_view(),
        name="ticket-attachment-upload",
    ),
    path(
        "projects/<uuid:project_id>/tickets/<uuid:ticket_id>/attachments/<uuid:attachment_id>/",
        TicketAttachmentDetailView.as_view(),
        name="ticket-attachment-detail",
    ),
    path(
        "workspaces/<slug:workspace_slug>/pages/<uuid:page_id>/attachments/",
        PageAttachmentView.as_view(),
        name="page-attachment-upload",
    ),
    path(
        "workspaces/<slug:workspace_slug>/pages/<uuid:page_id>/attachments/<uuid:attachment_id>/",
        PageAttachmentDetailView.as_view(),
        name="page-attachment-detail",
    ),
]
