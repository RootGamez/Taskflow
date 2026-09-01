"""Tareas Celery de notificaciones.

Deliberadamente finita: la tarea no decide nada, solo saca del request el
tiempo de red del SMTP y es el temporizador de la ventana de agrupacion.
Toda la logica (a quien, con que texto, si sigue correspondiendo mandarlo)
vive en `apps.notifications.delivery` y `apps.notifications.emails`.
"""

from __future__ import annotations

import logging

from celery import shared_task

from apps.notifications.delivery import (
    has_pending_notifications,
    release_digest_claim,
    schedule_digest,
    send_pending_notification_emails,
)

logger = logging.getLogger(__name__)


@shared_task(
    name="notifications.send_digest",
    # Reintenta con backoff: la causa tipica de fallo es un SMTP saturado o
    # una caida momentanea de red. Como no se sella nada si el envio falla,
    # el reintento vuelve a juntar las mismas novedades.
    autoretry_for=(Exception,),
    retry_backoff=10,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=3,
)
def send_notification_digest_task(user_id: str) -> int:
    try:
        sent_count = send_pending_notification_emails(user_id)
    finally:
        release_digest_claim(user_id)

    if not sent_count:
        # No es un error: pudieron borrarse las notificaciones, o el
        # usuario pudo apagar el switch durante la ventana.
        logger.info("Sin novedades que mandar por correo a %s", user_id)

    # Una notificacion pudo entrar entre la consulta y el sellado de
    # `send_pending_notification_emails`. Sin esta reprogramacion se
    # quedaria esperando a que llegara otra que volviera a abrir ventana.
    if has_pending_notifications(user_id):
        schedule_digest(user_id)

    return sent_count
