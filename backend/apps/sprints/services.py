"""Reglas de negocio de sprints, aisladas de las vistas HTTP.

Concentra dos decisiones deliberadas (ver plan tecnico, Seccion 4.3):

- D11: "completado" = ticket en la ultima columna del proyecto por `order`.
  No existe `ProjectColumn.is_done` (agregarlo exigiria tocar `apps.projects`,
  app prohibida para este agente, y una migracion nueva). El heuristico vive
  aislado en `get_done_column_id` para poder reemplazarlo por un flag real en
  un solo lugar el dia que exista.
- D14: `activate_sprint` es atomico y degrada el sprint activo anterior (si
  lo hay) a `completed` ANTES de promover el nuevo, dentro de la misma
  transaccion -- el orden importa por el constraint parcial
  `unique_active_sprint_per_project`. `.exclude(pk=sprint.pk)` hace la
  operacion idempotente: reactivar el sprint ya activo no toca nada mas.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count, Q, QuerySet

from apps.sprints.models import Sprint


def annotate_sprint_progress(queryset: QuerySet[Sprint]) -> QuerySet[Sprint]:
    """Anota `ticket_count` y `completed_ticket_count` sobre un queryset de
    `Sprint`, siempre con `annotate` (D12) -- nunca contando en Python, para
    no introducir un N+1 al listar sprints.

    "Completado" = el ticket esta en una columna de proyecto cuyo
    `WorkspaceStatus` tiene `is_done=True`. Un ticket sin columna mapeada a
    un estado no cuenta como completado.
    """
    return queryset.annotate(
        ticket_count=Count("tickets", distinct=True),
        completed_ticket_count=Count(
            "tickets",
            filter=Q(tickets__column__workspace_status__is_done=True),
            distinct=True,
        ),
    )


def activate_sprint(sprint: Sprint) -> Sprint:
    """Activa `sprint`, degradando a `completed` cualquier otro sprint
    activo del mismo proyecto. Atomico e idempotente (D14): activar el
    sprint que ya esta activo es un no-op efectivo.
    """
    with transaction.atomic():
        (
            Sprint.objects.select_for_update()
            .filter(workspace_id=sprint.workspace_id, status=Sprint.Status.ACTIVE)
            .exclude(pk=sprint.pk)
            .update(status=Sprint.Status.COMPLETED)
        )
        sprint.status = Sprint.Status.ACTIVE
        sprint.save(update_fields=["status", "updated_at"])

    return sprint


def complete_sprint(sprint: Sprint) -> Sprint:
    """Marca `sprint` como `completed`. No requiere transaccion: no toca
    ningun otro sprint (a diferencia de `activate_sprint`)."""
    sprint.status = Sprint.Status.COMPLETED
    sprint.save(update_fields=["status", "updated_at"])
    return sprint
