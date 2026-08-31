"""Adjuntos genericos del editor (Fase 2 del repotenciado de Tiptap).

Por que una app propia y no mas campos en `apps.tickets`:

`TicketImage` y `TicketVideo` (apps/tickets/models.py) son
ticket-scoped por construccion -- tienen un `FK(Ticket)` obligatorio. La
documentacion (`apps.pages.Page`) reusa el MISMO editor pero no puede
usar esos modelos, y por eso hasta ahora no podia adjuntar nada: ni una
imagen. Duplicar los modelos por cada superficie que monte el editor no
escala (manana: comentarios, plantillas).

`Attachment` resuelve eso con dos FKs nullables (`ticket`, `page`) y un
`CheckConstraint` que obliga a exactamente uno. Se descarto
`GenericForeignKey` a proposito: pierde integridad referencial en la
base, no permite `ON DELETE CASCADE` real y hace imposible un
`select_related`. Con dos columnas explicitas el borrado en cascada lo
hace Postgres y las consultas siguen siendo baratas. Si en el futuro
aparece una tercera superficie, se anade una tercera columna nullable y
se extiende el constraint -- un `ALTER TABLE`, no una migracion de datos.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Attachment(models.Model):
    """Archivo (PDF, Word, Excel...) referenciado desde el JSON del editor.

    A diferencia de `TicketImage`/`TicketVideo`, `url` NO es una URL
    publica permanente: los documentos viven en el bucket privado y se
    sirven con URLs prefirmadas de vida corta (ver
    `apps/attachments/storage.py`). Aqui se guarda solo `object_key`; la
    URL se firma en cada lectura.
    """

    class Scope(models.TextChoices):
        TICKET = "ticket", "Ticket"
        PAGE = "page", "Pagina"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    ticket = models.ForeignKey(
        "tickets.Ticket",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="attachments",
    )
    page = models.ForeignKey(
        "pages.Page",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="attachments",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_attachments",
    )

    # Clave del objeto en MinIO (ej. tickets/<uuid>/files/<uuid>.pdf).
    object_key = models.CharField(max_length=512)
    file_name = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)  # bytes
    # SHA-256 del contenido. Permite deduplicar y, sobre todo, detectar
    # que un objeto de MinIO no coincide con lo que se subio.
    checksum = models.CharField(max_length=64, blank=True)

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["ticket", "-created_at"]),
            models.Index(fields=["page", "-created_at"]),
        ]
        constraints = [
            # Exactamente un dueno. Sin esto, un adjunto huerfano (ambos
            # NULL) nunca se borraria en cascada y quedaria pagando
            # almacenamiento para siempre; y uno con los dos apuntaria a
            # dos documentos a la vez.
            models.CheckConstraint(
                check=(
                    models.Q(ticket__isnull=False, page__isnull=True)
                    | models.Q(ticket__isnull=True, page__isnull=False)
                ),
                name="attachment_has_exactly_one_owner",
            ),
        ]

    def __str__(self) -> str:
        return self.file_name or str(self.id)

    @property
    def scope(self) -> str:
        return self.Scope.TICKET if self.ticket_id else self.Scope.PAGE
