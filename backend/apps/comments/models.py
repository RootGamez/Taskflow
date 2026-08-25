from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Comment(models.Model):
    """Comentario de texto plano sobre un ticket.

    Decisiones de diseño (ver docs/DESIGN_SYSTEM.md 7.1 y el plan de la
    tanda "Comentarios + Actividad + Notificaciones"):
    - D1: cuerpo en texto plano (`body`), sin editor rico.
    - D2: menciones explícitas y validadas en servidor (`mentions`), nunca
      parseadas del texto libre.
    - D3: borrado lógico (`deleted_at`). El `body` nunca se borra porque lo
      referencian `Activity`/`Notification`.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(
        "tickets.Ticket",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="ticket_comments",
    )
    body = models.TextField()
    mentions = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="comment_mentions",
    )
    created_at = models.DateTimeField(default=timezone.now)
    # Se setea explícitamente en el PATCH del autor, nunca auto_now: un
    # auto_now se actualizaría también en operaciones internas (ej. algún
    # save() futuro que no sea una edición real del usuario).
    edited_at = models.DateTimeField(null=True, blank=True)
    # Soft-delete: el listado excluye deleted_at__isnull=False, pero la fila
    # (y su body) se conserva porque Activity/Notification la referencian.
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [models.Index(fields=["ticket", "created_at"])]

    def __str__(self) -> str:
        return f"{self.ticket_id} - {self.id}"
