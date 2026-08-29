from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from apps.subtasks.models import SubTask

# D26 de docs/PHASE_4_PLAN.md: importa el limite existente en lugar de
# redefinirlo -- una sola fuente de verdad para "cuantas subtareas puede
# tener un ticket", compartida por la creacion manual (apps/subtasks/views.py)
# y la creacion via plantilla (aca).
from apps.subtasks.views import MAX_SUBTASKS_PER_TICKET

if TYPE_CHECKING:
    from apps.tickets.models import Ticket
    from apps.tickettemplates.models import TicketTemplate
    from apps.users.models import User

logger = logging.getLogger(__name__)


def apply_template_items(ticket: "Ticket", template: "TicketTemplate | None", actor: "User | None") -> int:
    """Crea el checklist (`SubTask`) de `template` sobre `ticket`.

    D20 de docs/PHASE_4_PLAN.md: esta es la UNICA mitad de una plantilla que
    se aplica en el servidor -- titulo/descripcion/prioridad ya los manda el
    cliente como campos normales del POST (`applyTemplateToDraft` en el
    frontend). `TicketCreateSerializer.create` llama a esta funcion dentro de
    su `transaction.atomic()`, asi que un fallo aca revierte el ticket
    entero -- por eso D26 exige que esta funcion NUNCA lance por un exceso de
    items, solo trunque y loguee.
    """
    if template is None:
        return 0

    # El manager relacionado respeta `TicketTemplateItem.Meta.ordering`
    # (["order", "id"]) sin necesidad de un `.order_by()` explicito aca --
    # preserva el orden de la plantilla (D21).
    items = list(template.items.all())
    if not items:
        return 0

    if len(items) > MAX_SUBTASKS_PER_TICKET:
        # D26: nunca lanza -- el ticket ya se esta creando, fallar la
        # creacion entera por un checklist demasiado largo seria
        # desproporcionado. Se trunca y se deja constancia en el log.
        logger.warning(
            "La plantilla %s tiene %s items, mas que MAX_SUBTASKS_PER_TICKET "
            "(%s); se trunca el checklist del ticket %s.",
            template.id,
            len(items),
            MAX_SUBTASKS_PER_TICKET,
            ticket.id,
        )
        items = items[:MAX_SUBTASKS_PER_TICKET]

    subtasks = SubTask.objects.bulk_create(
        [
            SubTask(
                ticket=ticket,
                title=item.title,
                order=position,
                created_by=actor,
            )
            for position, item in enumerate(items, start=1)
        ]
    )
    return len(subtasks)
