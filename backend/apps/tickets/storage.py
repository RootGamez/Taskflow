from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import boto3
from botocore.client import Config
from django.conf import settings

_ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

# Límite de 10 MB por imagen de ticket
TICKET_IMAGE_MAX_SIZE_MB = 10


def _endpoint_url(endpoint: str, use_ssl: bool) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    scheme = "https" if use_ssl else "http"
    return f"{scheme}://{endpoint}"


def get_minio_client():
    return boto3.client(
        "s3",
        endpoint_url=_endpoint_url(settings.MINIO_ENDPOINT, settings.MINIO_USE_SSL),
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",
        config=Config(signature_version="s3v4", s3={'addressing_style': 'path'}),
    )


def build_public_object_url(object_key: str) -> str:
    from urllib.parse import quote

    base = _endpoint_url(settings.MINIO_PUBLIC_ENDPOINT, settings.MINIO_USE_SSL).rstrip("/")
    return f"{base}/{settings.MINIO_PUBLIC_BUCKET}/{quote(object_key)}"


def upload_ticket_image(file_obj, ticket_id: str, user_id: str) -> tuple[str, str]:
    """Sube una imagen de ticket a MinIO.

    Returns:
        Tuple (object_key, public_url).

    Raises:
        ValueError: si el tipo o tamaño no son válidos.
    """
    content_type = (getattr(file_obj, "content_type", None) or "").lower()
    extension = _ALLOWED_CONTENT_TYPES.get(content_type)
    if extension is None:
        raise ValueError(
            f"Formato no permitido: '{content_type}'. Usa JPG, PNG, WEBP o GIF."
        )

    max_size = TICKET_IMAGE_MAX_SIZE_MB * 1024 * 1024
    file_size = getattr(file_obj, "size", 0)
    if file_size > max_size:
        raise ValueError(
            f"La imagen supera el límite de {TICKET_IMAGE_MAX_SIZE_MB} MB."
        )

    # Respetar la extensión del archivo si es válida
    original_name = getattr(file_obj, "name", "") or ""
    safe_suffix = Path(original_name).suffix.lower()
    valid_suffixes = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    object_extension = safe_suffix if safe_suffix in valid_suffixes else extension

    object_key = f"tickets/{ticket_id}/images/{uuid4().hex}{object_extension}"

    file_obj.seek(0)
    client = get_minio_client()
    client.upload_fileobj(
        Fileobj=file_obj,
        Bucket=settings.MINIO_PUBLIC_BUCKET,
        Key=object_key,
        ExtraArgs={"ContentType": content_type},
    )

    public_url = build_public_object_url(object_key)
    return object_key, public_url
