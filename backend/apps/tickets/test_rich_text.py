"""Tests de `extract_plain_text` (WP-0, Fase 3).

Pytest plano, sin DB -- mismo patron que `apps/labels/test_palette.py`.
`Ticket.description` guarda JSON de Tiptap (ver docs/PHASE_3_PLAN.md D9):
esta funcion extrae el texto plano real para poder buscar por descripcion
sin que un `icontains` ingenuo matchee claves estructurales como "type",
"doc", "paragraph".
"""

from __future__ import annotations

import json

from apps.tickets.rich_text import extract_plain_text


def test_extracts_text_from_a_simple_tiptap_doc():
    doc = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Hola mundo"}],
            }
        ],
    }

    assert extract_plain_text(json.dumps(doc)) == "Hola mundo"


def test_extracts_text_from_nested_nodes():
    doc = {
        "type": "doc",
        "content": [
            {
                "type": "bulletList",
                "content": [
                    {
                        "type": "listItem",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": "Item anidado"}],
                            }
                        ],
                    }
                ],
            }
        ],
    }

    assert extract_plain_text(json.dumps(doc)) == "Item anidado"


def test_joins_paragraphs_with_a_single_space():
    doc = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Primero"}]},
            {"type": "paragraph", "content": [{"type": "text", "text": "Segundo"}]},
        ],
    }

    assert extract_plain_text(json.dumps(doc)) == "Primero Segundo"


def test_returns_empty_string_for_empty_input():
    assert extract_plain_text("") == ""
    assert extract_plain_text(None) == ""  # type: ignore[arg-type]


def test_returns_empty_string_for_malformed_json():
    assert extract_plain_text("{") == ""
    assert extract_plain_text("{invalid json,,,}") == ""


def test_returns_plain_legacy_text_unchanged():
    assert extract_plain_text("texto plano viejo sin json") == "texto plano viejo sin json"


def test_ignores_image_and_video_nodes_without_text():
    doc = {
        "type": "doc",
        "content": [
            {"type": "image", "attrs": {"src": "https://example.com/a.png"}},
            {"type": "paragraph", "content": [{"type": "text", "text": "Con imagen arriba"}]},
            {"type": "video", "attrs": {"src": "https://example.com/a.mp4"}},
        ],
    }

    assert extract_plain_text(json.dumps(doc)) == "Con imagen arriba"


def test_truncates_at_max_length():
    doc = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "a" * 100}]},
        ],
    }

    result = extract_plain_text(json.dumps(doc), max_length=10)

    assert result == "a" * 10
    assert len(result) == 10
