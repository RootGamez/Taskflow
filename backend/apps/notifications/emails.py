"""Composicion de los correos de notificacion.

Este modulo solo decide *que dice* un correo y como se ve. A quien se le
manda y cuando sale es problema de `apps.notifications.delivery`.

Hay dos formas del mismo mensaje:

- `build_notification_email`: una sola novedad, con su ficha y su boton.
- `build_digest_email`: varias novedades juntas en un resumen, que es lo
  que evita el reguero de correos cuando alguien comenta cinco veces
  seguidas en el mismo ticket.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterable, Sequence

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.text import Truncator

from apps.notifications.models import Notification

if TYPE_CHECKING:
    from apps.users.models import User

# Tipos de notificacion que viajan por correo, y el campo de `UserPreferences`
# que los gobierna. Un tipo que no este en este mapa jamas genera un correo
# (p. ej. `workspace_deleted`, que hoy solo vive dentro de la app).
EMAIL_PREFERENCE_FIELD: dict[str, str] = {
    Notification.Type.TICKET_ASSIGNED: "email_ticket_assigned",
    Notification.Type.TICKET_MENTIONED: "email_ticket_mentioned",
    Notification.Type.TICKET_COMMENTED: "email_ticket_commented",
}

#: Cuanto del comentario se cita en un correo de una sola novedad. Muy por
#: encima de los 140 caracteres del `comment_preview` que usa la campana: en
#: el correo el usuario no tiene la conversacion al lado, asi que el extracto
#: tiene que bastar para decidir si vale la pena abrir el ticket.
COMMENT_EXCERPT_CHARS = 600
#: En el resumen se cita mucho menos: son varias novedades en una pantalla,
#: y la idea es que se escaneen, no que se lean enteras.
DIGEST_EXCERPT_CHARS = 180
#: El asunto se corta antes de que lo corte el cliente de correo.
SUBJECT_TITLE_CHARS = 80
#: Cuantas novedades se listan en el resumen antes de resumirlas en un
#: "y N mas". El resto igual queda marcado como enviado: el correo avisa
#: que hay mas y el detalle esta en la app.
DIGEST_MAX_ITEMS = 10


@dataclass(frozen=True)
class NotificationEmailCopy:
    """Los textos que cambian entre un tipo de notificacion y otro."""

    subject: str
    eyebrow: str
    headline: str
    lead: str
    cta_label: str


@dataclass(frozen=True)
class DigestItem:
    """Una novedad dentro del resumen."""

    eyebrow: str
    headline: str
    lead: str
    ticket_title: str
    ticket_url: str
    comment_excerpt: str


def is_emailable(notification_type: str) -> bool:
    return notification_type in EMAIL_PREFERENCE_FIELD


def _comment_excerpts(
    notifications: Sequence[Notification],
    max_chars: int,
) -> dict[str, str]:
    """Extractos de los comentarios citados, indexados por `comment_id`.

    Relee el `body` del comentario (texto plano, ver
    `apps.comments.models.Comment`) en vez del `comment_preview` guardado en
    `data`, que esta recortado a 140 caracteres para la campana. Una sola
    consulta para todas las notificaciones: el resumen puede traer diez.
    """
    comment_ids = {
        notification.data.get("comment_id")
        for notification in notifications
        if notification.data.get("comment_id")
    }
    if not comment_ids:
        return {}

    from apps.comments.models import Comment

    # Las claves se pasan a str: en `data` los ids viajan serializados y
    # `values_list` los devuelve como UUID, que no casan entre si.
    bodies = {
        str(comment_id): body
        for comment_id, body in Comment.objects.filter(id__in=comment_ids).values_list(
            "id", "body"
        )
    }
    # Si el comentario ya no esta, queda el preview de `data` como respaldo.
    fallbacks = {
        notification.data["comment_id"]: notification.data.get("comment_preview") or ""
        for notification in notifications
        if notification.data.get("comment_id")
    }

    return {
        comment_id: Truncator(
            bodies.get(comment_id) or fallbacks.get(comment_id, "")
        ).chars(max_chars)
        for comment_id in comment_ids
    }


def _excerpt_for(
    notification: Notification,
    excerpts: dict[str, str],
) -> str:
    comment_id = notification.data.get("comment_id")
    return excerpts.get(comment_id, "") if comment_id else ""


def _copy_for(
    notification: Notification,
    actor_name: str,
    ticket_title: str,
) -> NotificationEmailCopy:
    short_title = Truncator(ticket_title).chars(SUBJECT_TITLE_CHARS)
    actor = actor_name or "Alguien"

    if notification.notification_type == Notification.Type.TICKET_ASSIGNED:
        return NotificationEmailCopy(
            subject=f"Te asignaron “{short_title}”",
            eyebrow="Asignacion",
            headline="Te asignaron un ticket",
            lead=(
                f"{actor} te asigno a este ticket."
                if actor_name
                else "Te asignaron a este ticket."
            ),
            cta_label="Ver el ticket",
        )

    if notification.notification_type == Notification.Type.TICKET_MENTIONED:
        return NotificationEmailCopy(
            subject=f"{actor} te menciono en “{short_title}”",
            eyebrow="Mencion",
            headline="Te mencionaron en un comentario",
            lead=f"{actor} te menciono en un comentario de este ticket.",
            cta_label="Responder en el ticket",
        )

    return NotificationEmailCopy(
        subject=f"Nuevo comentario en “{short_title}”",
        eyebrow="Comentario",
        headline="Nuevo comentario",
        lead=f"{actor} comento en un ticket en el que participas.",
        cta_label="Ver la conversacion",
    )


def _frontend_url() -> str:
    return settings.FRONTEND_URL.rstrip("/")


def _ticket_url(notification: Notification, frontend_url: str) -> str:
    ticket_id = notification.data.get("ticket_id")
    return f"{frontend_url}/tickets/{ticket_id}" if ticket_id else frontend_url


def _can_email(recipient: "User") -> bool:
    return bool(recipient.email) and recipient.is_active


def _render(
    subject: str,
    recipient_email: str,
    template_stem: str,
    context: dict,
) -> EmailMultiAlternatives:
    message = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string(f"emails/{template_stem}.txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )
    message.attach_alternative(
        render_to_string(f"emails/{template_stem}.html", context), "text/html"
    )
    return message


def build_notification_email(notification: Notification) -> EmailMultiAlternatives | None:
    """Correo de una sola novedad, o `None` si esta no lleva correo."""
    if not is_emailable(notification.notification_type):
        return None

    recipient = notification.recipient
    if not _can_email(recipient):
        return None

    frontend_url = _frontend_url()
    ticket_title = notification.data.get("ticket_title") or "un ticket"
    actor_name = notification.actor.full_name if notification.actor else ""
    copy = _copy_for(notification, actor_name, ticket_title)
    excerpts = _comment_excerpts([notification], COMMENT_EXCERPT_CHARS)

    context = {
        "copy": copy,
        "recipient_name": recipient.full_name or recipient.email,
        "actor_name": actor_name,
        "ticket_title": ticket_title,
        "comment_excerpt": _excerpt_for(notification, excerpts),
        "ticket_url": _ticket_url(notification, frontend_url),
        "preferences_url": f"{frontend_url}/settings/account",
    }

    return _render(copy.subject, recipient.email, "notification", context)


def _digest_subject(notifications: Sequence[Notification], total: int) -> str:
    ticket_ids = {notification.data.get("ticket_id") for notification in notifications}
    if len(ticket_ids) == 1 and next(iter(ticket_ids)):
        ticket_title = Truncator(
            notifications[0].data.get("ticket_title") or "un ticket"
        ).chars(SUBJECT_TITLE_CHARS)
        return f"{total} novedades en “{ticket_title}”"
    return f"{total} novedades en TaskFlow"


def build_digest_email(
    recipient: "User",
    notifications: Sequence[Notification],
) -> EmailMultiAlternatives | None:
    """Resumen con varias novedades del mismo usuario en un solo correo.

    Con una sola novedad no tiene sentido el formato de lista: se delega en
    `build_notification_email`, que la presenta con su ficha y su boton.
    """
    emailable = [item for item in notifications if is_emailable(item.notification_type)]
    if not emailable or not _can_email(recipient):
        return None
    if len(emailable) == 1:
        return build_notification_email(emailable[0])

    frontend_url = _frontend_url()
    # Mas nuevas primero, igual que la campana.
    ordered = sorted(emailable, key=lambda item: item.created_at, reverse=True)
    shown = ordered[:DIGEST_MAX_ITEMS]
    excerpts = _comment_excerpts(shown, DIGEST_EXCERPT_CHARS)

    items = []
    for notification in shown:
        ticket_title = notification.data.get("ticket_title") or "un ticket"
        actor_name = notification.actor.full_name if notification.actor else ""
        copy = _copy_for(notification, actor_name, ticket_title)
        items.append(
            DigestItem(
                eyebrow=copy.eyebrow,
                headline=copy.headline,
                lead=copy.lead,
                ticket_title=ticket_title,
                ticket_url=_ticket_url(notification, frontend_url),
                comment_excerpt=_excerpt_for(notification, excerpts),
            )
        )

    subject = _digest_subject(ordered, len(ordered))
    context = {
        "recipient_name": recipient.full_name or recipient.email,
        "items": items,
        "total": len(ordered),
        "hidden_count": max(len(ordered) - len(shown), 0),
        "inbox_url": f"{frontend_url}/dashboard",
        "preferences_url": f"{frontend_url}/settings/account",
    }

    return _render(subject, recipient.email, "notification_digest", context)


def build_email_for(
    recipient: "User",
    notifications: Iterable[Notification],
) -> EmailMultiAlternatives | None:
    """Un correo para todo lo que este pendiente de este usuario.

    Punto de entrada unico de la capa de composicion: decide sola si toca
    una novedad suelta o un resumen.
    """
    return build_digest_email(recipient, list(notifications))
