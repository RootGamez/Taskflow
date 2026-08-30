"""Serializers de `Attachment` (Fase 2 del repotenciado de Tiptap)."""

from __future__ import annotations

from rest_framework import serializers

from apps.attachments.models import Attachment
from apps.attachments.storage import build_presigned_url


class AttachmentSerializer(serializers.ModelSerializer):
    """Representacion que consume el nodo `file` del editor.

    `url` NO esta persistida: se firma en cada lectura porque los
    documentos viven en el bucket privado y la firma caduca en minutos.
    Por eso el frontend guarda el `id` en el JSON del documento, nunca la
    URL -- una URL firmada guardada en el contenido estaria muerta al
    dia siguiente.
    """

    url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = [
            "id",
            "url",
            "file_name",
            "content_type",
            "file_size",
            "checksum",
            "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_url(self, obj: Attachment) -> str:
        return build_presigned_url(obj.object_key, obj.file_name)

    def get_uploaded_by_name(self, obj: Attachment) -> str:
        user = obj.uploaded_by
        if user is None:
            return ""
        full_name = getattr(user, "get_full_name", lambda: "")()
        return full_name or getattr(user, "email", "") or ""
