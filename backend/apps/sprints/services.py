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
from django.db.models import Count, IntegerField, Q, QuerySet, Value

from apps.projects.models import Project
from apps.sprints.models import Sprint


def get_done_column_id(project: Project) -> str | None:
    """Devuelve el id (str) de la ultima columna del proyecto por `order`,
    o `None` si el proyecto no tiene columnas.

    Riesgo conocido (RA3, severidad MEDIA): en un proyecto con columnas
    renombradas o reordenadas manualmente, esto puede no ser la columna
    "real" de Hecho. Aceptado como simplificacion de v1 -- ver docstring del
    modulo.
    """
    last_column = project.columns.order_by("-order").first()
    return str(last_column.id) if last_column is not None else None


def annotate_sprint_progress(queryset: QuerySet[Sprint], done_column_id: str | None) -> QuerySet[Sprint]:
    """Anota `ticket_count` y `completed_ticket_count` sobre un queryset de
    `Sprint`, siempre con `annotate` (D12) -- nunca contando en Python, para
    no introducir un N+1 al listar sprints de un proyecto.

    `done_column_id is None` (RA4, proyecto sin columnas) usa un `Value(0)`
    explicito para `completed_ticket_count` en vez de dejar que
    `Q(tickets__column_id=None)` genere un `IS NULL` que además no tendria
    sentido semantico (ningun ticket tiene "columna nula").
    """
    ticket_count = Count("tickets", distinct=True)

    if done_column_id is None:
        completed_ticket_count = Value(0, output_field=IntegerField())
    else:
        completed_ticket_count = Count(
            "tickets",
            filter=Q(tickets__column_id=done_column_id),
            distinct=True,
        )

    return queryset.annotate(
        ticket_count=ticket_count,
        completed_ticket_count=completed_ticket_count,
    )


def activate_sprint(sprint: Sprint) -> Sprint:
    """Activa `sprint`, degradando a `completed` cualquier otro sprint
    activo del mismo proyecto. Atomico e idempotente (D14): activar el
    sprint que ya esta activo es un no-op efectivo.
    """
    with transaction.atomic():
        (
            Sprint.objects.select_for_update()
            .filter(project_id=sprint.project_id, status=Sprint.Status.ACTIVE)
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
