"""Reglas de negocio de la pizarra de metas semanales, aisladas de las vistas.

Concentra tres decisiones deliberadas (ver plan `docs/BRUTALIST_REDESIGN_PLAN.md`
Seccion 8):

- RD-3: `week_start` es SIEMPRE el lunes de la semana ISO actual, calculado
  server-side. `current_week_start()` es la unica fuente de verdad; el cliente
  nunca lo manda.
- RG3: `order` de una meta nueva = `max(order) + 1` dentro de
  `transaction.atomic()` con `select_for_update()` sobre el board, para que dos
  admins agregando metas a la vez no colisionen en el mismo `order`.
- RD-2: la transicion de `is_done` rellena/limpia `completed_by` y
  `completed_at`; marcar/desmarcar es idempotente si el valor no cambia.
"""

from __future__ import annotations

from datetime import date, timedelta

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.goals.models import WeeklyBoard, WeeklyGoalItem


def current_week_start() -> date:
    """Lunes de la semana ISO actual (RD-3)."""
    today = timezone.localdate()
    return today - timedelta(days=today.weekday())


def get_or_create_current_board(workspace, user) -> WeeklyBoard:
    """Devuelve el board de la semana ISO actual del espacio, creandolo vacio
    si no existe (RG1) -- el GET nunca devuelve 404.
    """
    board, _ = WeeklyBoard.objects.get_or_create(
        workspace=workspace,
        week_start=current_week_start(),
        defaults={"created_by": user},
    )
    return board


def create_goal_item(board: WeeklyBoard, text: str) -> WeeklyGoalItem:
    """Crea una meta al final de la lista. `order` se asigna server-side
    dentro de una transaccion (RG3).
    """
    with transaction.atomic():
        locked_board = WeeklyBoard.objects.select_for_update().get(pk=board.pk)
        next_order = (locked_board.items.aggregate(Max("order"))["order__max"] or 0) + 1
        return WeeklyGoalItem.objects.create(board=locked_board, text=text, order=next_order)


def apply_goal_item_update(item: WeeklyGoalItem, data: dict, user) -> WeeklyGoalItem:
    """Aplica un PATCH parcial sobre una meta.

    La validacion de permisos (texto/orden = OWNER/ADMIN, `is_done` = cualquier
    miembro) ya la hizo la vista; aca solo se persiste el cambio. En la
    transicion `is_done` false -> true se sella `completed_by`/`completed_at`;
    en true -> false se limpian (RD-2).
    """
    update_fields: list[str] = []

    if "text" in data:
        item.text = data["text"]
        update_fields.append("text")

    if "order" in data:
        item.order = data["order"]
        update_fields.append("order")

    if "is_done" in data and data["is_done"] != item.is_done:
        item.is_done = data["is_done"]
        update_fields.append("is_done")
        if item.is_done:
            item.completed_by = user
            item.completed_at = timezone.now()
        else:
            item.completed_by = None
            item.completed_at = None
        update_fields += ["completed_by", "completed_at"]

    if update_fields:
        item.save(update_fields=update_fields)

    return item
