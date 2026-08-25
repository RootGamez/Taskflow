"""Asignacion atomica del `Ticket.number` secuencial por proyecto.

Debe llamarse SIEMPRE desde dentro de una `transaction.atomic()` ya
existente (ver `TicketCreateSerializer.create()`), nunca standalone: los
dos `select_for_update()` de abajo solo protegen contra una carrera
concurrente si estan activos dentro de una transaccion.
"""

from __future__ import annotations

from django.db.models import Max

from apps.projects.models import Project
from apps.tickets.models import Ticket, TicketNumberSequence


def allocate_ticket_number(project: Project) -> int:
    """Devuelve el proximo numero secuencial para un ticket de `project` y
    persiste ese valor en `TicketNumberSequence` antes de devolverlo.

    `Project.objects.select_for_update()` sobre la fila del proyecto sirve
    de lock de serializacion: dos creaciones concurrentes de tickets en el
    mismo proyecto se serializan sobre esta fila, evitando que ambas lean
    el mismo estado y generen un numero duplicado. En Postgres esto
    bloquea de verdad (efectivo bajo carga concurrente). En SQLite (usado
    en tests/desarrollo local) `select_for_update()` es un no-op silencioso
    -- SQLite no soporta locking de filas y Django lo ignora en vez de
    fallar -- asi que la proteccion real contra colisiones en ese motor
    depende de que SQLite serialice escrituras a nivel de conexion/archivo,
    no de este lock.

    Los numeros NUNCA se reutilizan tras un borrado. Esto es la razon por
    la que el numero NO se deriva solo de `Max(Ticket.number)`: si se borra
    justo el ticket con el numero mas alto, un `Max()` sobre las filas
    vivas cae al numero anterior y lo repetiria. `TicketNumberSequence`
    persiste el ultimo valor entregado, independiente de que el ticket que
    lo tenia siga existiendo o no. Se combina con `Max()` sobre los tickets
    vivos (auto-sanacion: cubre tickets numerados fuera de este camino,
    como el backfill de datos legacy) tomando el mayor de los dos.
    """
    Project.objects.select_for_update().filter(pk=project.pk).first()

    sequence, _ = TicketNumberSequence.objects.select_for_update().get_or_create(project=project)
    max_existing_number = Ticket.objects.filter(project=project).aggregate(max_number=Max("number"))["max_number"] or 0

    next_number = max(sequence.last_value, max_existing_number) + 1
    sequence.last_value = next_number
    sequence.save(update_fields=["last_value"])

    return next_number
