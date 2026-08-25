"""Backfill de datos para `Ticket.number` (migracion 0008_backfill_ticket_numbers).

`backfill_ticket_numbers` recibe la CLASE de modelo como parametro, mismo
patron que `apps.projects.backfill.backfill_project_keys`: la migracion le
pasa el modelo historico y los tests le pasan el modelo real.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

BULK_UPDATE_BATCH_SIZE = 500


def backfill_ticket_numbers(ticket_model: Any) -> int:
    """Asigna `number` secuencial (1..N) a los tickets de cada proyecto que
    todavia no lo tienen, ordenados por `(created_at, id)` para que el
    numero refleje el orden real de creacion.

    Idempotente: solo toca filas con `number__isnull=True`; tickets que ya
    tienen numero (de una corrida anterior, o creados despues via
    `allocate_ticket_number`) nunca se re-numeran. Devuelve la cantidad de
    tickets efectivamente actualizados.
    """
    tickets_by_project: dict[Any, list[Any]] = defaultdict(list)
    pending_tickets = ticket_model.objects.filter(number__isnull=True).order_by("project_id", "created_at", "id")
    for ticket in pending_tickets:
        tickets_by_project[ticket.project_id].append(ticket)

    if not tickets_by_project:
        return 0

    existing_max_by_project: dict[Any, int] = {}
    for project_id in tickets_by_project:
        max_number = (
            ticket_model.objects.filter(project_id=project_id, number__isnull=False)
            .order_by("-number")
            .values_list("number", flat=True)
            .first()
        )
        existing_max_by_project[project_id] = max_number or 0

    to_update: list[Any] = []
    for project_id, tickets in tickets_by_project.items():
        next_number = existing_max_by_project[project_id] + 1
        for ticket in tickets:
            ticket.number = next_number
            next_number += 1
            to_update.append(ticket)

    ticket_model.objects.bulk_update(to_update, ["number"], batch_size=BULK_UPDATE_BATCH_SIZE)
    return len(to_update)
