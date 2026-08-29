from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Page(models.Model):
    """Documentacion/wiki de un workspace (docs/PHASE_4_PLAN.md D5).

    Workspace-scoped (no project-scoped): la documentacion transversal de
    un equipo no deberia vivir duplicada por proyecto. `project` es
    opcional -- el caso de uso #1 del roadmap ("README de proyecto") se
    cubre asociando una pagina a un proyecto sin obligar a que todas las
    paginas tengan uno.

    `on_delete=SET_NULL` en `project` (no `CASCADE`): borrar un proyecto
    jamas debe destruir documentacion. Mismo criterio ya usado para
    `Ticket.sprint` (apps/tickets/models.py:40-42) -- borrar un sprint
    jamas borra sus tickets, solo los desasocia.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        "workspaces.Workspace",
        on_delete=models.CASCADE,
        related_name="pages",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pages",
    )
    # CASCADE (no SET_NULL): borrar una pagina borra su subarbol completo
    # (D17 de docs/PHASE_4_PLAN.md) -- una sub-pagina huerfana en la raiz
    # del arbol pierde su contexto y ensucia la navegacion.
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    title = models.CharField(max_length=200)
    # Emoji del icono de la pagina, sin upload (D6: v1 no tiene subida de
    # imagenes). 8 chars cubre emojis compuestos (secuencias ZWJ) tipicas.
    icon = models.CharField(max_length=8, blank=True, default="")
    # JSON de Tiptap, igual que Ticket.description.
    content = models.TextField(blank=True, default="")
    # Texto plano extraido de `content` (apps.tickets.rich_text.
    # extract_plain_text, reusada tal cual -- D10) para que el `?q=` del
    # indice de paginas no tenga que hacer icontains sobre el blob JSON
    # crudo. Se calcula en el serializer (WP-P), nunca aca ni en un
    # signal -- mismo criterio que Ticket.description_text.
    content_text = models.TextField(blank=True, default="")
    # D15 (WP-P): de solo lectura en v1, `max(order)+1` al crear entre
    # hermanos. El campo vive en el modelo desde el dia 1 para no
    # necesitar una migracion cuando llegue el reordenamiento manual.
    order = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_pages",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="updated_pages",
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "created_at"]
        indexes = [
            models.Index(fields=["workspace", "parent", "order"]),
            models.Index(fields=["workspace", "updated_at"]),
        ]
        constraints = [
            # Red de ultimo recurso contra A->A (RP-3 / R0A-6). No cubre
            # ciclos indirectos (A->B->A): esos los valida el servicio
            # `would_create_cycle` (D12, WP-P) antes de guardar.
            models.CheckConstraint(
                check=~models.Q(parent=models.F("id")),
                name="page_parent_not_self",
            ),
        ]

    def __str__(self) -> str:
        return self.title
