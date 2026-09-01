"""Disparadores de notificaciones para tickets.

Firmas estables consumidas por `apps.comments` (menciones/comentarios) y
`apps.activities` (asignaciones, vía `apps.tickets.serializers`).

Cada disparador decide *a quién* le corresponde la notificación y arma su
contenido; el reparto por los dos canales de salida (campana por WebSocket
y correo) está centralizado en `_create_and_fan_out`, para que agregar un
tipo nuevo no obligue a acordarse de los dos.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from apps.notifications.delivery import enqueue_notification_emails
from apps.notifications.models import Notification
from apps.notifications.realtime import send_notification_event
from apps.notifications.serializers import NotificationSerializer
from apps.workspaces.models import WorkspaceMember

if TYPE_CHECKING:
    from uuid import UUID

    from apps.comments.models import Comment
    from apps.tickets.models import Ticket
    from apps.users.models import User


def _create_and_fan_out(pending_notifications: list[Notification]) -> list[Notification]:
    """Guarda las notificaciones y dispara sus dos canales de salida.

    La campana (WebSocket) sale en el acto; el correo se encola y se manda
    despues del commit, y solo a quien lo tenga activado -- ver
    `apps.notifications.delivery`.
    """
    created_notifications = Notification.objects.bulk_create(pending_notifications)

    for notification in created_notifications:
        send_notification_event(
            str(notification.recipient_id),
            {
                "type": "notification.created",
                "notification": NotificationSerializer(notification).data,
            },
        )

    enqueue_notification_emails(created_notifications)

    return created_notifications


def notify_ticket_assigned(
    ticket: "Ticket",
    actor: "User | None",
    added_user_ids: list["UUID"],
) -> list[Notification]:
    """Notifica a los usuarios recién asignados a `ticket`.

    Contrato de `Notification.data`:
        {"ticket_id": str, "ticket_title": str, "project_id": str, "workspace_slug": str}

    No debe notificar a `actor` (si se autoasigna) ni volver a notificar a
    alguien que ya estaba asignado (por eso recibe solo los IDs agregados,
    no el estado final de `assignees`).
    """
    recipient_ids = {
        user_id for user_id in added_user_ids if actor is None or str(user_id) != str(actor.id)
    }
    if not recipient_ids:
        return []

    data = {
        "ticket_id": str(ticket.id),
        "ticket_title": ticket.title,
        "project_id": str(ticket.project_id),
        "workspace_slug": ticket.project.workspace.slug,
    }
    title = f'Te asignaron el ticket "{ticket.title}"'
    message = (
        f"{actor.full_name} te asigno a este ticket." if actor is not None else "Te asignaron a este ticket."
    )

    pending_notifications = [
        Notification(
            recipient_id=user_id,
            actor=actor,
            notification_type=Notification.Type.TICKET_ASSIGNED,
            title=title,
            message=message,
            data=data,
        )
        for user_id in recipient_ids
    ]

    return _create_and_fan_out(pending_notifications)


def notify_comment_created(comment: "Comment") -> list[Notification]:
    """Notifica menciones y a los "seguidores" del ticket de `comment`.

    - Cada usuario en `comment.mentions` recibe `TICKET_MENTIONED`.
    - Los seguidores del ticket (creador + asignados + autores de
      comentarios previos no borrados, intersectados con membership vigente
      del workspace) reciben `TICKET_COMMENTED`, excluyendo al autor del
      comentario y a quien ya recibió `TICKET_MENTIONED` por este mismo
      comentario (sin duplicar).

    Contrato de `Notification.data`:
        {
            "ticket_id": str, "ticket_title": str, "project_id": str,
            "workspace_slug": str, "comment_id": str, "comment_preview": str,
        }

    La intersección con `WorkspaceMember` vigente es obligatoria: un usuario
    que comentó o fue asignado en el pasado y luego salió del workspace no
    debe seguir recibiendo notificaciones del ticket.
    """
    from apps.comments.models import Comment as CommentModel  # evita import circular a nivel de módulo

    ticket = comment.ticket
    project = ticket.project
    workspace = project.workspace
    author_id = comment.author_id

    mention_ids: set["UUID"] = set(comment.mentions.values_list("id", flat=True))

    follower_ids: set["UUID"] = set()
    if ticket.created_by_id:
        follower_ids.add(ticket.created_by_id)
    follower_ids.update(ticket.assignees.values_list("id", flat=True))
    follower_ids.update(
        CommentModel.objects.filter(ticket=ticket, deleted_at__isnull=True)
        .exclude(id=comment.id)
        .exclude(author_id__isnull=True)
        .values_list("author_id", flat=True)
    )

    # No auto-notificar al autor, y no duplicar: quien ya recibe
    # TICKET_MENTIONED por este comentario no recibe además TICKET_COMMENTED.
    follower_ids -= {author_id}
    follower_ids -= mention_ids

    # Intersección obligatoria con membership vigente del workspace.
    workspace_member_ids = set(
        WorkspaceMember.objects.filter(
            workspace=workspace, user_id__in=follower_ids | mention_ids
        ).values_list("user_id", flat=True)
    )
    follower_ids &= workspace_member_ids
    valid_mention_ids = (mention_ids & workspace_member_ids) - {author_id}

    if not follower_ids and not valid_mention_ids:
        return []

    comment_preview = comment.body[:140]
    data = {
        "ticket_id": str(ticket.id),
        "ticket_title": ticket.title,
        "project_id": str(project.id),
        "workspace_slug": workspace.slug,
        "comment_id": str(comment.id),
        "comment_preview": comment_preview,
    }

    pending_notifications = [
        Notification(
            recipient_id=user_id,
            actor=comment.author,
            notification_type=Notification.Type.TICKET_MENTIONED,
            title=f'Te mencionaron en "{ticket.title}"',
            message=comment_preview,
            data=data,
        )
        for user_id in valid_mention_ids
    ] + [
        Notification(
            recipient_id=user_id,
            actor=comment.author,
            notification_type=Notification.Type.TICKET_COMMENTED,
            title=f'Nuevo comentario en "{ticket.title}"',
            message=comment_preview,
            data=data,
        )
        for user_id in follower_ids
    ]

    return _create_and_fan_out(pending_notifications)
