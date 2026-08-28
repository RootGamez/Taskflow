"""Backfill de datos para `apps.tickets` (migraciones 0008 y 0011).

Cada funcion recibe la CLASE de modelo como parametro, mismo patron que
`apps.projects.backfill.backfill_project_keys`: la migracion le pasa el
modelo historico (`apps.get_model(...)`) y los tests le pasan el modelo
real.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from apps.tickets.rich_text import extract_plain_text

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


def backfill_description_text(ticket_model: Any) -> int:
    """Popula `Ticket.description_text` extrayendo el texto plano del JSON
    de Tiptap guardado en `description`, para los tickets que todavia no lo
    tienen (docs/PHASE_3_PLAN.md D9/D10, migracion 0011).

    Idempotente: solo toca filas con `description_text=""` y `description`
    no vacia -- correr esto de nuevo despues de que el serializer ya
    empezo a poblar `description_text` en runtime (D11) no pisa nada.
    Devuelve la cantidad de tickets efectivamente actualizados.
    """
    pending_tickets = list(
        ticket_model.objects.filter(description_text="").exclude(description="")
    )

    if not pending_tickets:
        return 0

    for ticket in pending_tickets:
        ticket.description_text = extract_plain_text(ticket.description)

    ticket_model.objects.bulk_update(pending_tickets, ["description_text"], batch_size=BULK_UPDATE_BATCH_SIZE)
    return len(pending_tickets)
