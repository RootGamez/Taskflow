"""Motor de historial de actividad de un ticket.

Firmas estables consumidas por `apps.tickets.serializers` (creación/edición
de tickets, tanto HTTP como WebSocket) y por `apps.comments` (evento
"commented").

Decisiones de implementación (ver resumen de la tanda para más contexto):

- El evento realtime (`activity.created`) se emite DESDE ACÁ (dentro de
  `record_ticket_created`/`record_ticket_changes`/`record_comment_created`),
  no desde el serializer. Mantiene la responsabilidad de "una actividad se
  persistió, hay que avisar por WS" pegada al punto donde se sabe
  exactamente qué se persistió (incluida la fila coalescida en D6), sin que
  el serializer tenga que re-derivar esa información.
- `record_ticket_changes` devuelve la lista de `Activity` afectadas (nuevas
  + la fila coalescida si se actualizó una existente). El serializer puede
  derivar `added_user_ids` para `notify_ticket_assigned` filtrando esa
  misma lista por `action == Activity.Action.ASSIGNED` en vez de volver a
  diffear `assignees` con una query aparte — "calculalo una vez y reusalo".
- `due_date_changed` es la única acción cuyo `from_value`/`to_value` NO usa
  la forma `{"id", "label"}` de D4: al no haber una entidad referenciada
  (no hay un "id" de fecha), se guarda directamente el string ISO o `None`.
  El resto de las acciones (title/priority/status/assigned/unassigned/
  sprint_changed) sí usa la forma fija `{"id": str | None, "label": str}`.
  `sprint_changed` sigue el mismo patrón que `status_changed`: `id=None`
  y `label="Backlog"` cuando el ticket no tiene sprint asignado.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.activities.models import Activity
from apps.activities.realtime import send_activity_event
from apps.activities.serializers import ActivitySerializer
from apps.tickets.models import Ticket

if TYPE_CHECKING:
    from apps.comments.models import Comment
    from apps.users.models import User

# Ventana de coalescencia para `title_changed` (D6): el título se autoguarda
# con debounce de 450ms, así que ráfagas de PATCH consecutivos del mismo
# actor dentro de esta ventana actualizan la última fila en vez de crear
# una nueva.
ACTIVITY_COALESCE_WINDOW_SECONDS = 120


@dataclass(frozen=True)
class TicketSnapshot:
    """Estado de los campos observados de un ticket, tomado antes de guardar
    los cambios, para poder diffear contra el estado post-guardado."""

    title: str
    priority: str
    column_id: UUID
    column_name: str
    due_date: object | None  # datetime | None
    assignee_ids: frozenset[UUID]
    # M2M: un ticket puede estar en varios sprints a la vez.
    sprint_ids: frozenset[UUID]
    sprint_label: str


def take_snapshot(ticket: "Ticket") -> TicketSnapshot:
    """Toma un snapshot de `ticket` ANTES de aplicar los cambios entrantes.

    Debe llamarse al principio de `TicketUpdateSerializer.update()`, antes
    de mutar el instance. `assignee_ids` cuesta una query
    (`values_list("id", flat=True)`) que debe leerse antes de que el
    `.set()` de assignees se ejecute.

    CRITICO: `take_snapshot()` corre FUERA del try/except del serializer
    (ver `TicketUpdateSerializer.update()`) -- se llama antes de que
    empiece la transaccion, no dentro del bloque protegido de
    actividad/notificaciones. Un `AttributeError` aca devuelve 500 en el
    PATCH del ticket y puede cortar la conexion de WebSocket del panel de
    detalle (`TicketConsumer._patch_ticket` no tiene su propio
    try/except). Por eso `sprint_id`/`sprint_name` se escriben access
    directo a `ticket.sprint_id` (nunca dispara query, siempre presente
    aunque sea `None`) en vez de `ticket.sprint.name`, que si `sprint_id`
    es `None` lanzaria `AttributeError: 'NoneType' object has no attribute
    'name'`.
    """
    sprint_pairs = list(ticket.sprints.values_list("id", "name"))
    return TicketSnapshot(
        title=ticket.title,
        priority=ticket.priority,
        column_id=ticket.column_id,
        column_name=ticket.column.name,
        due_date=ticket.due_date,
        assignee_ids=frozenset(ticket.assignees.values_list("id", flat=True)),
        sprint_ids=frozenset(pair[0] for pair in sprint_pairs),
        sprint_label=", ".join(sorted(name for _, name in sprint_pairs)) or "Backlog",
    )


def _emit(activity: Activity) -> None:
    send_activity_event(str(activity.ticket_id), ActivitySerializer(activity).data)


def record_ticket_created(ticket: "Ticket", actor: "User | None") -> Activity:
    """Registra el evento `created`. Se llama una sola vez, desde
    `TicketCreateSerializer.create()`. Nunca debe ir acompañado de otros
    eventos (status_changed/assigned) por los valores iniciales del ticket.
    """
    activity = Activity.objects.create(
        ticket=ticket,
        actor=actor,
        action=Activity.Action.CREATED,
        from_value=None,
        to_value=None,
    )
    _emit(activity)
    return activity


def _due_date_value(value) -> str | None:
    return value.isoformat() if value else None


def _record_title_change(
    ticket: "Ticket",
    actor: "User | None",
    old_title: str,
    new_title: str,
) -> Activity | None:
    """Coalescencia D6.

    Si la última `title_changed` de este `(ticket, actor)` tiene menos de
    `ACTIVITY_COALESCE_WINDOW_SECONDS` segundos, actualiza esa fila
    (`to_value` nuevo, `from_value` original preservado) en vez de insertar
    una nueva. Si el coalesce resulta en `from_value == to_value` (volvió al
    valor original), borra la fila y devuelve `None`.

    Devuelve un `Activity` sin guardar (`_state.adding is True`) cuando hay
    que insertarlo via `bulk_create`, o un `Activity` ya persistido
    (actualizado in-place) cuando coalesció con una fila existente.
    """
    now = timezone.now()
    last = (
        Activity.objects.filter(ticket=ticket, actor=actor, action=Activity.Action.TITLE_CHANGED)
        .order_by("-created_at")
        .first()
    )

    if last is not None and (now - last.created_at).total_seconds() < ACTIVITY_COALESCE_WINDOW_SECONDS:
        original_title = last.from_value["label"] if last.from_value else None
        if original_title == new_title:
            last.delete()
            return None

        last.to_value = {"id": None, "label": new_title}
        last.save(update_fields=["to_value"])
        return last

    return Activity(
        ticket=ticket,
        actor=actor,
        action=Activity.Action.TITLE_CHANGED,
        from_value={"id": None, "label": old_title},
        to_value={"id": None, "label": new_title},
    )


def record_ticket_changes(
    ticket: "Ticket",
    actor: "User | None",
    snapshot: TicketSnapshot,
) -> list[Activity]:
    """Compara `snapshot` (pre-cambio) contra el estado actual de `ticket`
    (post-guardado) y registra solo los cambios reales: title (con
    coalescencia por ventana de tiempo), priority, column (status_changed,
    solo si el id realmente cambió), due_date, y un assigned/unassigned por
    cada assignee agregado/quitado. `description`, `progress_notes` y
    `order` se ignoran a propósito (autosave de alta frecuencia / reordenar
    no es un evento de negocio).
    """
    to_create: list[Activity] = []
    already_persisted: list[Activity] = []

    if snapshot.title != ticket.title:
        title_activity = _record_title_change(ticket, actor, snapshot.title, ticket.title)
        if title_activity is not None:
            if title_activity._state.adding:
                to_create.append(title_activity)
            else:
                already_persisted.append(title_activity)

    if snapshot.priority != ticket.priority:
        to_create.append(
            Activity(
                ticket=ticket,
                actor=actor,
                action=Activity.Action.PRIORITY_CHANGED,
                from_value={"id": snapshot.priority, "label": Ticket.Priority(snapshot.priority).label},
                to_value={"id": ticket.priority, "label": Ticket.Priority(ticket.priority).label},
            )
        )

    if snapshot.column_id != ticket.column_id:
        to_create.append(
            Activity(
                ticket=ticket,
                actor=actor,
                action=Activity.Action.STATUS_CHANGED,
                from_value={"id": str(snapshot.column_id), "label": snapshot.column_name},
                to_value={"id": str(ticket.column_id), "label": ticket.column.name},
            )
        )

    current_sprint_pairs = list(ticket.sprints.values_list("id", "name"))
    current_sprint_ids = frozenset(pair[0] for pair in current_sprint_pairs)
    if snapshot.sprint_ids != current_sprint_ids:
        current_label = ", ".join(sorted(name for _, name in current_sprint_pairs)) or "Backlog"
        to_create.append(
            Activity(
                ticket=ticket,
                actor=actor,
                action=Activity.Action.SPRINT_CHANGED,
                from_value={
                    "id": None,
                    "ids": sorted(str(i) for i in snapshot.sprint_ids),
                    "label": snapshot.sprint_label,
                },
                to_value={
                    "id": None,
                    "ids": sorted(str(i) for i in current_sprint_ids),
                    "label": current_label,
                },
            )
        )

    if snapshot.due_date != ticket.due_date:
        to_create.append(
            Activity(
                ticket=ticket,
                actor=actor,
                action=Activity.Action.DUE_DATE_CHANGED,
                from_value=_due_date_value(snapshot.due_date),
                to_value=_due_date_value(ticket.due_date),
            )
        )

    current_assignee_ids = frozenset(ticket.assignees.values_list("id", flat=True))
    added_ids = current_assignee_ids - snapshot.assignee_ids
    removed_ids = snapshot.assignee_ids - current_assignee_ids

    if added_ids or removed_ids:
        users_by_id = dict(
            get_user_model().objects.filter(id__in=added_ids | removed_ids).values_list("id", "full_name")
        )
        for user_id in added_ids:
            to_create.append(
                Activity(
                    ticket=ticket,
                    actor=actor,
                    action=Activity.Action.ASSIGNED,
                    from_value=None,
                    to_value={"id": str(user_id), "label": users_by_id.get(user_id, "")},
                )
            )
        for user_id in removed_ids:
            to_create.append(
                Activity(
                    ticket=ticket,
                    actor=actor,
                    action=Activity.Action.UNASSIGNED,
                    from_value={"id": str(user_id), "label": users_by_id.get(user_id, "")},
                    to_value=None,
                )
            )

    if to_create:
        Activity.objects.bulk_create(to_create)

    changed_activities = [*to_create, *already_persisted]
    for activity in changed_activities:
        _emit(activity)

    return changed_activities


def record_comment_created(comment: "Comment") -> Activity:
    """Registra el evento `commented` para el ticket de `comment`.

    Asume el contrato documentado del modelo `Comment` (`ticket`, `author`)
    tal como está descrito en docs/ROADMAP_FUNCIONALIDADES.md — ese modelo
    lo implementa `apps.comments` (Agente A) en paralelo.
    """
    activity = Activity.objects.create(
        ticket=comment.ticket,
        actor=comment.author,
        action=Activity.Action.COMMENTED,
        from_value=None,
        to_value=None,
    )
    _emit(activity)
    return activity
