"""Extraccion de texto plano desde el JSON de Tiptap de `Ticket.description`.

`Ticket.description` guarda el documento serializado del editor Tiptap
(ver `TicketDetail.tsx:864` en el frontend, que hace
`JSON.parse`/`JSON.stringify` sobre el mismo blob). Un `icontains` ingenuo
sobre esa columna matchearia claves estructurales ("type", "doc",
"content", "paragraph", "textAlign") en practicamente todos los tickets
(docs/PHASE_3_PLAN.md D9). `extract_plain_text` recorre el arbol de nodos y
concatena unicamente los nodos `text`, para poblar la columna
desnormalizada `Ticket.description_text` que la busqueda usa de verdad.

Defensiva por contrato (D10): nunca lanza. `""` para entrada vacia o JSON
invalido; texto plano legacy (pre-Tiptap) se devuelve tal cual; se trunca a
`max_length` para que un documento con cientos de nodos no infle la
columna.
"""

from __future__ import annotations

import json
from typing import Any

DEFAULT_MAX_LENGTH = 5000


def _collect_text_fragments(node: Any, fragments: list[str]) -> None:
    """Recorre un nodo (y sus hijos) de un documento Tiptap/ProseMirror,
    juntando el `text` de cada nodo de tipo `text`. Nodos sin `content` ni
    `text` (imagenes, videos, etc.) se ignoran silenciosamente.
    """
    if isinstance(node, list):
        for item in node:
            _collect_text_fragments(item, fragments)
        return

    if not isinstance(node, dict):
        return

    text = node.get("text")
    if isinstance(text, str) and text:
        fragments.append(text)

    children = node.get("content")
    if children:
        _collect_text_fragments(children, fragments)


def extract_plain_text(raw: str | None, max_length: int = DEFAULT_MAX_LENGTH) -> str:
    """Convierte el `description` crudo (JSON de Tiptap o texto legacy) en
    texto plano, unido con un unico espacio entre fragmentos, truncado a
    `max_length`.
    """
    if not raw:
        return ""

    stripped = raw.strip()
    if not stripped:
        return ""

    # Mismo heuristico que `TicketDetail.tsx::buildDraft` en el frontend
    # (`isProbablyJson`): solo lo que "parece" JSON (arranca con `{`/`[`)
    # se intenta parsear. Si arranca asi y falla, es un documento Tiptap
    # corrupto -- se descarta (R0-2) en vez de indexar basura sintactica.
    # Si no arranca asi, es texto plano legacy y se devuelve tal cual.
    looks_like_json = stripped[0] in "{["
    if not looks_like_json:
        return stripped[:max_length]

    try:
        parsed = json.loads(stripped)
    except (json.JSONDecodeError, ValueError):
        return ""

    if not isinstance(parsed, (dict, list)):
        # JSON valido pero no es un documento Tiptap (ej. un numero o un
        # string JSON-encoded) -- tratar como texto plano.
        return stripped[:max_length]

    fragments: list[str] = []
    _collect_text_fragments(parsed, fragments)

    joined = " ".join(fragments)
    return joined[:max_length]
