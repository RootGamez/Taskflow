"""Serializers de `Attachment` (Fase 2 del repotenciado de Tiptap)."""

from __future__ import annotations

from rest_framework import serializers

from apps.attachments.models import Attachment


class AttachmentSerializer(serializers.ModelSerializer):
    """Representacion que consume el nodo `file` del editor.

    No se expone ninguna URL: la descarga va por el endpoint de detalle
    del adjunto, que es estable, exige autenticacion y sirve el archivo
    en streaming desde el bucket privado. El frontend guarda el `id` en
    el JSON del documento y construye la ruta con el.
    """

    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            "id",
            "file_name",
            "content_type",
            "file_size",
            "checksum",
            "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_uploaded_by_name(self, obj: Attachment) -> str:
        user = obj.uploaded_by
        if user is None:
            return ""
        full_name = getattr(user, "get_full_name", lambda: "")()
        return full_name or getattr(user, "email", "") or ""
