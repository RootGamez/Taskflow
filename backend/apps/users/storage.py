from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse
from urllib.parse import quote
from uuid import uuid4

import boto3
from botocore.client import Config
from django.conf import settings

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


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
        config=Config(signature_version="s3v4"),
    )


def build_public_object_url(object_key: str) -> str:
    base = _endpoint_url(settings.MINIO_PUBLIC_ENDPOINT, settings.MINIO_USE_SSL).rstrip("/")
    return f"{base}/{settings.MINIO_PUBLIC_BUCKET}/{quote(object_key)}"


def normalize_avatar_url(raw_avatar_url: str | None) -> str | None:
    if not raw_avatar_url:
        return None

    # Si ya es una URL del bucket público actual, no tocamos nada.
    public_bucket_segment = f"/{settings.MINIO_PUBLIC_BUCKET}/"
    if public_bucket_segment in raw_avatar_url:
        return raw_avatar_url

    # Si guardamos solo la key (users/.../avatar.png), construimos URL pública.
    if not raw_avatar_url.startswith("http://") and not raw_avatar_url.startswith("https://"):
        return build_public_object_url(raw_avatar_url.lstrip("/"))

    # Compatibilidad con URLs antiguas en bucket legacy (taskflow-media).
    parsed = urlparse(raw_avatar_url)
    legacy_bucket_segment = f"/{settings.MINIO_BUCKET}/"
    if legacy_bucket_segment in parsed.path:
        object_key = parsed.path.split(legacy_bucket_segment, 1)[1]
        return build_public_object_url(object_key)

    return raw_avatar_url


def upload_user_avatar(file_obj, user_id: str) -> str:
    content_type = (file_obj.content_type or "").lower()
    extension = _ALLOWED_CONTENT_TYPES.get(content_type)
    if extension is None:
        raise ValueError("Formato no permitido. Usa JPG, PNG, WEBP o GIF.")

    max_size = settings.MINIO_AVATAR_MAX_SIZE_MB * 1024 * 1024
    if file_obj.size > max_size:
        raise ValueError(f"La imagen supera el limite de {settings.MINIO_AVATAR_MAX_SIZE_MB}MB.")

    safe_suffix = Path(file_obj.name).suffix.lower()
    object_extension = safe_suffix if safe_suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else extension
    object_key = f"users/{user_id}/avatars/{uuid4().hex}{object_extension}"

    file_obj.seek(0)
    client = get_minio_client()
    client.upload_fileobj(
        Fileobj=file_obj,
        Bucket=settings.MINIO_PUBLIC_BUCKET,
        Key=object_key,
        ExtraArgs={"ContentType": content_type},
    )

    return build_public_object_url(object_key)
