"""Subida de documentos a MinIO (Fase 2 del repotenciado de Tiptap).

Sigue el patron de `apps/tickets/storage.py` (mismo cliente boto3, misma
forma de `(object_key, url)`, mismos `ValueError` para que la vista los
traduzca a 400), con tres endurecimientos que aquel no tiene:

1. **Bucket privado.** Un PDF de contrato o un Excel de nomina no debe
   quedar en una URL publica adivinable, que es donde acaban hoy las
   imagenes y videos. Los documentos van a `MINIO_PRIVATE_BUCKET` y se
   sirven con URLs prefirmadas de vida corta.

2. **Sniff del contenido.** `apps/tickets/storage.py` confia en el
   `content_type` que manda el navegador, que es texto libre del cliente:
   un `.exe` renombrado a `.pdf` pasa el filtro. Aqui se leen los magic
   bytes del archivo y se exige que concuerden con la extension.

3. **Checksum.** SHA-256 del contenido, para poder detectar despues que
   el objeto en MinIO no es el que se subio.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from uuid import uuid4

import boto3
from botocore.client import Config
from django.conf import settings

# Tipos de documento permitidos -> extension canonica.
ALLOWED_DOCUMENT_TYPES: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    "application/vnd.oasis.opendocument.text": ".odt",
    "application/vnd.oasis.opendocument.spreadsheet": ".ods",
    "text/csv": ".csv",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "application/json": ".json",
    "application/zip": ".zip",
    "application/x-zip-compressed": ".zip",
}

# Extension -> tipo canonico. Los navegadores mandan `application/octet-stream`
# con demasiada frecuencia (sobre todo en movil y para formatos de Office),
# asi que la extension es el desempate, igual que ya hace
# `upload_ticket_video` para los videos.
DOCUMENT_TYPE_BY_SUFFIX: dict[str, str] = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ods": "application/vnd.oasis.opendocument.spreadsheet",
    ".csv": "text/csv",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".zip": "application/zip",
}

ATTACHMENT_MAX_SIZE_MB = 50

# Vida de la URL prefirmada. Corta a proposito: el frontend la pide justo
# antes de descargar, no la guarda en el JSON del documento.
PRESIGNED_URL_TTL_SECONDS = 300

# Firmas de archivo (magic bytes). Solo para los formatos con una firma
# estable y sin ambiguedad; los de texto plano (csv, txt, md, json) no
# tienen firma y se validan solo por extension y tamano.
_MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    ".pdf": (b"%PDF-",),
    # OOXML y ODF son ZIPs. `PK\x03\x04` es el archivo normal;
    # `PK\x05\x06` es un ZIP vacio y `PK\x07\x08` uno spanned.
    ".docx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".xlsx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".pptx": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".odt": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".ods": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    ".zip": (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"),
    # Formatos binarios de Office 97-2003: contenedor OLE2.
    ".doc": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    ".xls": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
    ".ppt": (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",),
}

_MAGIC_READ_BYTES = 8
_CHECKSUM_CHUNK_BYTES = 64 * 1024


def _endpoint_url(endpoint: str, use_ssl: bool) -> str:
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    scheme = "https" if use_ssl else "http"
    return f"{scheme}://{endpoint}"


def _build_client(endpoint: str):
    return boto3.client(
        "s3",
        endpoint_url=_endpoint_url(endpoint, settings.MINIO_USE_SSL),
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def get_minio_client():
    """Cliente para hablar con MinIO desde el servidor (red interna)."""
    return _build_client(settings.MINIO_ENDPOINT)


def get_public_minio_client():
    """Cliente para FIRMAR URLs que va a abrir un navegador.

    Tiene que apuntar a `MINIO_PUBLIC_ENDPOINT`, no a `MINIO_ENDPOINT`.
    En Docker el servidor llega a MinIO por `minio:9000` pero el navegador
    solo resuelve `localhost:9000`, y SigV4 firma la cabecera `Host`: una
    URL firmada para `minio:9000` no solo apunta a un host inalcanzable,
    sino que ademas deja de validar en cuanto alguien le cambia el host a
    mano. Por eso la firma tiene que generarse ya contra el endpoint
    publico.
    """
    return _build_client(settings.MINIO_PUBLIC_ENDPOINT)


def ensure_bucket_exists(client, bucket_name: str) -> None:
    try:
        client.head_bucket(Bucket=bucket_name)
    except Exception:
        client.create_bucket(Bucket=bucket_name)


def resolve_document_type(content_type: str, file_name: str) -> tuple[str, str]:
    """Devuelve `(content_type_canonico, extension)`.

    Raises:
        ValueError: si ni el MIME ni la extension son de un tipo permitido.
    """
    normalized = (content_type or "").lower().split(";")[0].strip()
    suffix = Path(file_name or "").suffix.lower()

    extension = ALLOWED_DOCUMENT_TYPES.get(normalized)
    if extension is not None:
        return normalized, extension

    # El navegador no dio un MIME util (octet-stream y similares): decide
    # la extension.
    canonical = DOCUMENT_TYPE_BY_SUFFIX.get(suffix)
    if canonical is not None:
        return canonical, suffix

    raise ValueError(
        f"Formato no permitido: '{content_type or suffix or 'desconocido'}'. "
        "Usa PDF, Word, Excel, PowerPoint, ODF, CSV, TXT, Markdown, JSON o ZIP."
    )


def assert_magic_bytes_match(file_obj, extension: str) -> None:
    """Comprueba que el contenido real coincide con la extension.

    Los formatos de texto plano no tienen firma, asi que se saltan.

    Raises:
        ValueError: si la firma no concuerda.
    """
    signatures = _MAGIC_SIGNATURES.get(extension)
    if not signatures:
        return

    file_obj.seek(0)
    header = file_obj.read(_MAGIC_READ_BYTES)
    file_obj.seek(0)

    if not any(header.startswith(signature) for signature in signatures):
        raise ValueError(
            f"El contenido del archivo no corresponde a un {extension.lstrip('.').upper()}."
        )


def compute_checksum(file_obj) -> str:
    """SHA-256 en streaming -- no carga 50 MB en memoria."""
    digest = hashlib.sha256()
    file_obj.seek(0)
    for chunk in iter(lambda: file_obj.read(_CHECKSUM_CHUNK_BYTES), b""):
        digest.update(chunk)
    file_obj.seek(0)
    return digest.hexdigest()


def build_presigned_url(object_key: str, file_name: str = "") -> str:
    """URL de descarga temporal para un objeto del bucket privado.

    Firmada contra el endpoint PUBLICO -- ver `get_public_minio_client`.
    """
    client = get_public_minio_client()
    params: dict[str, str] = {
        "Bucket": settings.MINIO_PRIVATE_BUCKET,
        "Key": object_key,
    }
    if file_name:
        # Fuerza la descarga con el nombre original en vez de la clave UUID.
        params["ResponseContentDisposition"] = f'attachment; filename="{file_name}"'

    return client.generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=PRESIGNED_URL_TTL_SECONDS,
    )


def upload_attachment(file_obj, scope: str, owner_id: str) -> tuple[str, str, str, int]:
    """Sube un documento al bucket PRIVADO de MinIO.

    Args:
        file_obj: el `UploadedFile` de la request.
        scope: "tickets" o "pages" -- primer segmento de la clave.
        owner_id: UUID del ticket o de la pagina.

    Returns:
        `(object_key, content_type, checksum, file_size)`. No devuelve URL:
        los documentos privados se firman en cada lectura con
        `build_presigned_url`.

    Raises:
        ValueError: si el tipo, el tamano o el contenido no son validos.
    """
    file_name = getattr(file_obj, "name", "") or ""
    content_type, extension = resolve_document_type(
        getattr(file_obj, "content_type", "") or "", file_name
    )

    file_size = getattr(file_obj, "size", 0) or 0
    max_size = ATTACHMENT_MAX_SIZE_MB * 1024 * 1024
    if file_size > max_size:
        raise ValueError(f"El archivo supera el limite de {ATTACHMENT_MAX_SIZE_MB} MB.")
    if file_size == 0:
        raise ValueError("El archivo esta vacio.")

    assert_magic_bytes_match(file_obj, extension)
    checksum = compute_checksum(file_obj)

    object_key = f"{scope}/{owner_id}/files/{uuid4().hex}{extension}"

    file_obj.seek(0)
    client = get_minio_client()
    ensure_bucket_exists(client, settings.MINIO_PRIVATE_BUCKET)
    client.upload_fileobj(
        Fileobj=file_obj,
        Bucket=settings.MINIO_PRIVATE_BUCKET,
        Key=object_key,
        ExtraArgs={"ContentType": content_type},
    )

    return object_key, content_type, checksum, file_size


def stream_attachment(object_key: str):
    """Abre un objeto del bucket privado para servirlo desde el backend.

    Returns:
        `(body, content_type, content_length)`. `body` es un stream: hay
        que cerrarlo, cosa que hace `FileResponse` por nosotros.

    Se sirve a traves de Django en vez de redirigir a una URL prefirmada
    porque el redirect tenia dos problemas encadenados: el navegador no
    resuelve el host interno de MinIO, y al seguir el redirect arrastraba
    la cabecera `Authorization` de la API, que S3 rechaza cuando la
    peticion ya viene firmada por query string. Sirviendo desde aqui, el
    navegador nunca habla con MinIO y el bucket privado sigue siendo
    privado de verdad.
    """
    client = get_minio_client()
    response = client.get_object(Bucket=settings.MINIO_PRIVATE_BUCKET, Key=object_key)
    return (
        response["Body"],
        response.get("ContentType") or "application/octet-stream",
        response.get("ContentLength") or 0,
    )
