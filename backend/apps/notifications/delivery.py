"""Entrega de los correos de notificacion: a quien, cuando y una sola vez.

El problema que resuelve este modulo es el reguero de correos: sin nada en
el medio, cinco comentarios seguidos en el mismo ticket son cinco correos.
La solucion es una ventana de agrupacion
(`settings.NOTIFICATION_EMAIL_DIGEST_SECONDS`, 5 minutos por defecto):

1. Al crearse una notificacion no se manda nada; se *reserva* al usuario en
   la cache con `cache.add`, que en Redis es atomico. Solo el primero de la
   rafaga consigue la reserva y agenda una tarea Celery con `countdown`.
2. Todo lo que llegue durante esa ventana no agenda nada: se sube a la
   tarea que ya esta esperando.
3. Al vencer la ventana, la tarea junta todo lo pendiente del usuario y lo
   manda en un solo correo -- una novedad suelta si hubo una, un resumen si
   hubo varias.

Lo que decide que esta "pendiente" es `Notification.email_sent_at`, no la
cache: si Redis se vacia no se duplica ni se pierde ningun correo, a lo
sumo se atrasa hasta la proxima notificacion.

Poner la ventana en 0 desactiva la agrupacion y vuelve al envio inmediato.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Sequence

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.notifications.emails import EMAIL_PREFERENCE_FIELD, build_email_for, is_emailable
from apps.notifications.models import Notification
from apps.users.models import UserPreferences

if TYPE_CHECKING:
    from uuid import UUID

logger = logging.getLogger(__name__)

#: Prefijo de la reserva por usuario en la cache.
DIGEST_CLAIM_PREFIX = "notifications:digest:"
#: Margen sobre la ventana para que la reserva no expire antes de que la
#: tarea llegue a soltarla (worker ocupado, reintento con backoff...). Si
#: aun asi expira, lo peor que pasa es que se agende una segunda tarea que
#: no encuentra nada pendiente.
DIGEST_CLAIM_GRACE_SECONDS = 120
#: Mas viejas que esto no se mandan: si el worker estuvo caido un dia
#: entero, mandar ese historico es peor que callarse -- el usuario ya lo
#: vio en la campana. Se sellan igual para que no queden dando vueltas.
DIGEST_MAX_AGE = timedelta(hours=24)


def emails_enabled() -> bool:
    return bool(getattr(settings, "NOTIFICATION_EMAILS_ENABLED", True))


def digest_window_seconds() -> int:
    """Ventana de agrupacion en segundos. 0 = mandar en el acto."""
    return max(int(getattr(settings, "NOTIFICATION_EMAIL_DIGEST_SECONDS", 300)), 0)


def wants_email(user_id: "UUID | str", notification_type: str) -> bool:
    """Si este usuario acepta correo para este tipo de notificacion.

    La ausencia de fila en `UserPreferences` significa "quiere todo": los
    defaults del modelo son `True` y no hay ninguna garantia de que la fila
    exista (solo se crea en el primer PATCH de preferencias). Por eso la
    consulta pregunta si *opto por salir*, no si acepta.

    Pregunta por un usuario y no por un conjunto a proposito: el correo se
    arma por persona (una ventana de agrupacion por destinatario), y una
    version con conjuntos obligaba a restar ids que segun el llamador
    llegan como UUID o como str -- una resta que no falla, simplemente no
    encuentra nada, y termina mandandole correo a quien los apago.
    """
    if not is_emailable(notification_type):
        return False

    preference_field = EMAIL_PREFERENCE_FIELD[notification_type]
    opted_out = (
        UserPreferences.objects.filter(user_id=user_id)
        .filter(Q(email_notifications=False) | Q(**{preference_field: False}))
        .exists()
    )
    return not opted_out


def pending_notifications(user_id: "UUID | str") -> list[Notification]:
    """Notificaciones de este usuario que todavia no salieron por correo."""
    return list(
        Notification.objects.filter(
            recipient_id=user_id,
            email_sent_at__isnull=True,
            notification_type__in=EMAIL_PREFERENCE_FIELD,
        )
        .select_related("recipient", "actor")
        .order_by("created_at")
    )


def has_pending_notifications(user_id: "UUID | str") -> bool:
    return Notification.objects.filter(
        recipient_id=user_id,
        email_sent_at__isnull=True,
        notification_type__in=EMAIL_PREFERENCE_FIELD,
    ).exists()


def send_pending_notification_emails(user_id: "UUID | str") -> int:
    """Manda en un solo correo todo lo pendiente del usuario.

    Devuelve cuantas novedades viajaron. Sella *todas* las pendientes, no
    solo las enviadas: las que se descartan (preferencia apagada, o
    demasiado viejas) no tienen que volver a evaluarse en la proxima
    ventana.

    Si el envio falla no se sella nada, asi que el reintento de Celery
    vuelve a encontrarlas y las manda enteras.
    """
    pending = pending_notifications(user_id)
    if not pending:
        return 0

    now = timezone.now()
    fresh = [item for item in pending if item.created_at >= now - DIGEST_MAX_AGE]

    # Las preferencias se releen aca, no al encolar: entre que se creo la
    # notificacion y que vence la ventana el usuario pudo apagar el switch.
    wanted_types = {
        notification_type
        for notification_type in {item.notification_type for item in fresh}
        if wants_email(user_id, notification_type)
    }
    to_send = [item for item in fresh if item.notification_type in wanted_types]

    sent_count = 0
    if to_send:
        message = build_email_for(to_send[0].recipient, to_send)
        if message is not None:
            message.send(fail_silently=False)
            sent_count = len(to_send)

    Notification.objects.filter(id__in=[item.id for item in pending]).update(
        email_sent_at=now
    )
    return sent_count


def _claim_key(user_id: "UUID | str") -> str:
    return f"{DIGEST_CLAIM_PREFIX}{user_id}"


def release_digest_claim(user_id: "UUID | str") -> None:
    """Suelta la reserva para que la proxima notificacion agende de nuevo."""
    cache.delete(_claim_key(user_id))


def schedule_digest(user_id: "UUID | str") -> bool:
    """Agenda el correo agrupado de este usuario si nadie lo agendo ya.

    Devuelve `True` si esta llamada fue la que agendo. `cache.add` es la
    pieza clave: es atomico, asi que de una rafaga de notificaciones
    simultaneas (varios workers incluidos) solo una agenda la tarea.
    """
    from apps.notifications.tasks import send_notification_digest_task

    window = digest_window_seconds()
    key = _claim_key(user_id)

    if not cache.add(key, "1", timeout=window + DIGEST_CLAIM_GRACE_SECONDS):
        return False

    try:
        send_notification_digest_task.apply_async(args=[str(user_id)], countdown=window)
    except Exception:
        # Sin tarea agendada la reserva solo serviria para bloquear los
        # intentos siguientes durante toda la ventana.
        cache.delete(key)
        logger.exception("No se pudo agendar el correo agrupado de %s", user_id)
        return False

    return True


def enqueue_notification_emails(notifications: Sequence[Notification]) -> None:
    """Punto de entrada de `apps.notifications.services`.

    Blindado entero: el correo es un efecto secundario del comentario o de
    la asignacion, asi que ni un broker caido ni una cache ilegible pueden
    tumbar la operacion que lo disparo.
    """
    if not notifications or not emails_enabled():
        return

    try:
        recipient_ids = {
            item.recipient_id
            for item in notifications
            if is_emailable(item.notification_type)
        }
    except Exception:
        logger.exception("No se pudieron resolver los destinatarios de correo")
        return

    if not recipient_ids:
        return

    def _dispatch() -> None:
        for recipient_id in recipient_ids:
            try:
                schedule_digest(recipient_id)
            except Exception:
                logger.exception(
                    "No se pudo agendar el correo agrupado de %s", recipient_id
                )

    # `on_commit` para no agendar sobre notificaciones que el worker
    # todavia no puede ver (otra conexion, otra transaccion). Fuera de una
    # transaccion Django lo ejecuta en el acto.
    transaction.on_commit(_dispatch)
