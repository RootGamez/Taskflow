"""Correo de las notificaciones de ticket.

Tres piezas separadas a proposito:

1. `recipients_wanting_email` decide *a quien* se le manda, leyendo
   `UserPreferences` en una sola consulta.
2. `build_notification_email` decide *que* se manda: arma el asunto, el
   contexto y renderiza las dos variantes (texto y HTML) del mismo mensaje.
3. `enqueue_notification_emails` es el unico punto de entrada que usa
   `apps.notifications.services`: filtra por preferencia y encola una tarea
   Celery por destinatario, ya despues del commit.

El envio nunca es sincrono dentro del request: un SMTP lento o caido
bloquearia el POST del comentario o el PATCH del ticket.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Iterable, Sequence

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils.text import Truncator

from apps.notifications.models import Notification
from apps.users.models import UserPreferences

if TYPE_CHECKING:
    from uuid import UUID

logger = logging.getLogger(__name__)

# Tipos de notificacion que viajan por correo, y el campo de `UserPreferences`
# que los gobierna. Un tipo que no este en este mapa jamas genera un correo
# (p. ej. `workspace_deleted`, que hoy solo vive dentro de la app).
EMAIL_PREFERENCE_FIELD: dict[str, str] = {
    Notification.Type.TICKET_ASSIGNED: "email_ticket_assigned",
    Notification.Type.TICKET_MENTIONED: "email_ticket_mentioned",
    Notification.Type.TICKET_COMMENTED: "email_ticket_commented",
}

#: Cuanto del comentario se cita en el correo. Muy por encima de los 140
#: caracteres del `comment_preview` que usa la campana: en el correo el
#: usuario no tiene la conversacion al lado, asi que el extracto tiene que
#: bastar para decidir si vale la pena abrir el ticket.
COMMENT_EXCERPT_CHARS = 600
#: El asunto se corta antes de que lo corte el cliente de correo.
SUBJECT_TITLE_CHARS = 80


@dataclass(frozen=True)
class NotificationEmailCopy:
    """Los textos que cambian entre un tipo de notificacion y otro."""

    subject: str
    eyebrow: str
    headline: str
    lead: str
    cta_label: str


def is_emailable(notification_type: str) -> bool:
    return notification_type in EMAIL_PREFERENCE_FIELD


def recipients_wanting_email(
    notification_type: str,
    recipient_ids: Iterable["UUID"],
) -> set["UUID"]:
    """Subconjunto de `recipient_ids` que acepta correo para este tipo.

    La ausencia de fila en `UserPreferences` significa "quiere todo": los
    defaults del modelo son `True` y no hay ninguna garantia de que la fila
    exista (solo se crea en el primer PATCH de preferencias). Por eso la
    consulta busca a los que *optaron por salir*, no a los que aceptan.
    """
    wanted_ids = set(recipient_ids)
    if not wanted_ids or not is_emailable(notification_type):
        return set()

    preference_field = EMAIL_PREFERENCE_FIELD[notification_type]
    opted_out = set(
        UserPreferences.objects.filter(user_id__in=wanted_ids)
        .filter(Q(email_notifications=False) | Q(**{preference_field: False}))
        .values_list("user_id", flat=True)
    )

    return wanted_ids - opted_out


def _comment_excerpt(notification: Notification) -> str:
    """Extracto del comentario citado, o "" si la notificacion no cita uno.

    Prefiere releer el `body` del comentario (texto plano, ver
    `apps.comments.models.Comment`) antes que el `comment_preview` guardado
    en `data`, que esta recortado a 140 caracteres para la campana.
    """
    comment_id = notification.data.get("comment_id")
    if not comment_id:
        return ""

    from apps.comments.models import Comment

    body = (
        Comment.objects.filter(id=comment_id).values_list("body", flat=True).first()
        or notification.data.get("comment_preview")
        or ""
    )
    return Truncator(body).chars(COMMENT_EXCERPT_CHARS)


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


def build_notification_email(notification: Notification) -> EmailMultiAlternatives | None:
    """Mensaje listo para enviar, o `None` si esta notificacion no lleva correo."""
    if not is_emailable(notification.notification_type):
        return None

    recipient = notification.recipient
    if not recipient.email or not recipient.is_active:
        return None

    frontend_url = settings.FRONTEND_URL.rstrip("/")
    ticket_id = notification.data.get("ticket_id")
    ticket_title = notification.data.get("ticket_title") or "un ticket"
    actor_name = notification.actor.full_name if notification.actor else ""

    copy = _copy_for(notification, actor_name, ticket_title)

    context = {
        "copy": copy,
        "recipient_name": recipient.full_name or recipient.email,
        "actor_name": actor_name,
        "ticket_title": ticket_title,
        "comment_excerpt": _comment_excerpt(notification),
        "ticket_url": f"{frontend_url}/tickets/{ticket_id}" if ticket_id else frontend_url,
        "preferences_url": f"{frontend_url}/settings/account",
    }

    message = EmailMultiAlternatives(
        subject=copy.subject,
        body=render_to_string("emails/notification.txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient.email],
    )
    message.attach_alternative(render_to_string("emails/notification.html", context), "text/html")
    return message


def send_notification_email(notification_id: str) -> bool:
    """Envia el correo de una notificacion. `True` si salio algo.

    Se relee la notificacion (y su preferencia) desde la base a proposito:
    entre el encolado y la ejecucion de la tarea pudo pasar cualquier cosa
    -- que borren la notificacion, o que el usuario apague el switch.
    """
    notification = (
        Notification.objects.filter(id=notification_id)
        .select_related("recipient", "actor")
        .first()
    )
    if notification is None:
        return False

    if notification.recipient_id not in recipients_wanting_email(
        notification.notification_type, [notification.recipient_id]
    ):
        return False

    message = build_notification_email(notification)
    if message is None:
        return False

    message.send(fail_silently=False)
    return True


def enqueue_notification_emails(notifications: Sequence[Notification]) -> None:
    """Encola un correo por notificacion, para quien lo haya dejado activado.

    Blindado entero: el correo es un efecto secundario del comentario o de
    la asignacion, asi que ni un broker caido ni una preferencia ilegible
    pueden tumbar la operacion que lo disparo.
    """
    if not notifications or not getattr(settings, "NOTIFICATION_EMAILS_ENABLED", True):
        return

    try:
        emailable = [item for item in notifications if is_emailable(item.notification_type)]
        if not emailable:
            return

        # Una consulta de preferencias por tipo presente, no una por
        # notificacion: un comentario con diez menciones son dos consultas.
        allowed_by_type = {
            notification_type: recipients_wanting_email(
                notification_type,
                [
                    item.recipient_id
                    for item in emailable
                    if item.notification_type == notification_type
                ],
            )
            for notification_type in {item.notification_type for item in emailable}
        }

        pending_ids = [
            str(item.id)
            for item in emailable
            if item.recipient_id in allowed_by_type[item.notification_type]
        ]
    except Exception:
        logger.exception("No se pudieron resolver los destinatarios de correo de notificaciones")
        return

    if not pending_ids:
        return

    def _dispatch() -> None:
        from apps.notifications.tasks import send_notification_email_task

        for notification_id in pending_ids:
            try:
                send_notification_email_task.delay(notification_id)
            except Exception:
                logger.exception(
                    "No se pudo encolar el correo de la notificacion %s", notification_id
                )

    # `on_commit` para no encolar una tarea que corra antes de que la
    # notificacion exista para el worker (otra conexion, otra transaccion).
    # Fuera de una transaccion Django lo ejecuta en el acto.
    transaction.on_commit(_dispatch)
