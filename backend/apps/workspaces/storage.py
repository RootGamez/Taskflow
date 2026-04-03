from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from django.conf import settings

from apps.users.storage import build_public_object_url, get_minio_client

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def upload_workspace_logo(file_obj, workspace_id: str) -> str:
    content_type = (file_obj.content_type or "").lower()
    extension = _ALLOWED_CONTENT_TYPES.get(content_type)
    if extension is None:
        raise ValueError("Formato no permitido. Usa JPG, PNG, WEBP o GIF.")

    max_size = settings.MINIO_WORKSPACE_LOGO_MAX_SIZE_MB * 1024 * 1024
    if file_obj.size > max_size:
        raise ValueError(
            f"La imagen supera el limite de {settings.MINIO_WORKSPACE_LOGO_MAX_SIZE_MB}MB."
        )

    safe_suffix = Path(file_obj.name).suffix.lower()
    object_extension = (
        safe_suffix if safe_suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else extension
    )
    object_key = f"workspaces/{workspace_id}/logos/{uuid4().hex}{object_extension}"

    file_obj.seek(0)
    client = get_minio_client()
    client.upload_fileobj(
        Fileobj=file_obj,
        Bucket=settings.MINIO_PUBLIC_BUCKET,
        Key=object_key,
        ExtraArgs={"ContentType": content_type},
    )

    return build_public_object_url(object_key)
