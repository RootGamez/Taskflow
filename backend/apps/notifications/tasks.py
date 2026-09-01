"""Tareas Celery de notificaciones.

Deliberadamente finitas: la tarea no decide nada, solo saca del request el
tiempo de red del SMTP. Toda la logica (a quien, con que texto, si sigue
correspondiendo mandarlo) vive en `apps.notifications.emails`.
"""

from __future__ import annotations

import logging

from celery import shared_task

from apps.notifications.emails import send_notification_email

logger = logging.getLogger(__name__)


@shared_task(
    name="notifications.send_notification_email",
    # Reintenta con backoff: la causa tipica de fallo es un SMTP saturado o
    # una caida momentanea de red, no un mensaje mal armado.
    autoretry_for=(Exception,),
    retry_backoff=10,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=3,
)
def send_notification_email_task(notification_id: str) -> bool:
    sent = send_notification_email(notification_id)
    if not sent:
        # No es un error: la notificacion pudo borrarse, o el usuario pudo
        # apagar el switch entre el encolado y la ejecucion.
        logger.info("Correo de notificacion %s omitido", notification_id)
    return sent
