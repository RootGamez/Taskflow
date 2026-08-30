"""Tests de `apps/attachments/storage.py` (Fase 2 del repotenciado).

Pytest plano sin DB ni MinIO -- mismo patron que
`apps/tickets/test_rich_text.py` y `apps/labels/test_palette.py`. Solo se
cubren las funciones puras: resolucion de tipo, magic bytes y checksum.
La subida en si (`upload_attachment`) toca boto3 y se prueba en los tests
de vista, con el cliente mockeado.
"""

from __future__ import annotations

import hashlib
import io

import pytest

from apps.attachments.storage import (
    ALLOWED_DOCUMENT_TYPES,
    assert_magic_bytes_match,
    compute_checksum,
    resolve_document_type,
)


class _FakeUpload(io.BytesIO):
    """Imita lo justo de `UploadedFile`: `name`, `content_type`, `size`."""

    def __init__(self, content: bytes, name: str = "", content_type: str = ""):
        super().__init__(content)
        self.name = name
        self.content_type = content_type
        self.size = len(content)


# --- resolve_document_type ---------------------------------------------------


def test_resolves_a_known_mime_type_to_its_extension():
    content_type, extension = resolve_document_type("application/pdf", "informe.pdf")

    assert content_type == "application/pdf"
    assert extension == ".pdf"


def test_ignores_charset_parameters_in_the_mime_type():
    content_type, extension = resolve_document_type("text/csv; charset=utf-8", "datos.csv")

    assert content_type == "text/csv"
    assert extension == ".csv"


def test_falls_back_to_the_extension_when_the_browser_sends_octet_stream():
    # Caso real: Safari en iOS manda octet-stream para .docx.
    content_type, extension = resolve_document_type(
        "application/octet-stream", "contrato.docx"
    )

    assert (
        content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert extension == ".docx"
    # El tipo canonico tiene que seguir estando en la allowlist.
    assert ALLOWED_DOCUMENT_TYPES[content_type] == ".docx"


def test_rejects_a_type_that_is_neither_a_known_mime_nor_a_known_extension():
    with pytest.raises(ValueError, match="Formato no permitido"):
        resolve_document_type("application/x-msdownload", "virus.exe")


def test_rejects_a_file_with_no_type_and_no_extension():
    with pytest.raises(ValueError, match="Formato no permitido"):
        resolve_document_type("", "sin_extension")


# --- assert_magic_bytes_match ------------------------------------------------


def test_accepts_a_pdf_whose_content_really_starts_with_the_pdf_signature():
    upload = _FakeUpload(b"%PDF-1.7\nrest of the file")

    assert_magic_bytes_match(upload, ".pdf")  # no lanza


def test_rejects_an_executable_renamed_to_pdf():
    # `MZ` es la firma de un PE de Windows.
    upload = _FakeUpload(b"MZ\x90\x00\x03\x00\x00\x00")

    with pytest.raises(ValueError, match="no corresponde a un PDF"):
        assert_magic_bytes_match(upload, ".pdf")


def test_accepts_ooxml_files_because_they_are_zip_containers():
    upload = _FakeUpload(b"PK\x03\x04\x14\x00\x06\x00")

    assert_magic_bytes_match(upload, ".docx")  # no lanza
    assert_magic_bytes_match(upload, ".xlsx")
    assert_magic_bytes_match(upload, ".pptx")


def test_accepts_legacy_office_files_with_the_ole2_signature():
    upload = _FakeUpload(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1")

    assert_magic_bytes_match(upload, ".doc")  # no lanza


def test_skips_the_check_for_plain_text_formats_that_have_no_signature():
    upload = _FakeUpload(b"a,b,c\n1,2,3\n")

    assert_magic_bytes_match(upload, ".csv")  # no lanza
    assert_magic_bytes_match(upload, ".txt")
    assert_magic_bytes_match(upload, ".md")


def test_rewinds_the_file_so_the_upload_can_read_it_afterwards():
    upload = _FakeUpload(b"%PDF-1.7 contenido")

    assert_magic_bytes_match(upload, ".pdf")

    assert upload.tell() == 0
    assert upload.read().startswith(b"%PDF-")


# --- compute_checksum --------------------------------------------------------


def test_computes_the_sha256_of_the_whole_content():
    content = b"contenido del archivo" * 100
    upload = _FakeUpload(content)

    assert compute_checksum(upload) == hashlib.sha256(content).hexdigest()


def test_rewinds_the_file_after_computing_the_checksum():
    upload = _FakeUpload(b"algo")

    compute_checksum(upload)

    assert upload.tell() == 0


def test_reads_across_chunk_boundaries():
    # Mayor que _CHECKSUM_CHUNK_BYTES (64 KB) para forzar varias vueltas.
    content = b"x" * (64 * 1024 * 2 + 7)
    upload = _FakeUpload(content)

    assert compute_checksum(upload) == hashlib.sha256(content).hexdigest()
