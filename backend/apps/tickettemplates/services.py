from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.tickets.models import Ticket
    from apps.tickettemplates.models import TicketTemplate
    from apps.users.models import User


def apply_template_items(ticket: "Ticket", template: "TicketTemplate | None", actor: "User | None") -> int:
    """Crea el checklist (`SubTask`) de `template` sobre `ticket`.

    Stub de WP-0A (docs/PHASE_4_PLAN.md seccion 3.1): siempre devuelve
    `0` sin tocar la base de datos. `TicketCreateSerializer.create` ya
    llama a esta funcion dentro de su `transaction.atomic()` (D20) para
    que WP-T solo tenga que reescribir el cuerpo de este archivo -- el
    call site y su contrato (`(ticket, template, actor) -> int`, "items
    creados") quedan fijos desde el dia 1.
    """
    return 0
