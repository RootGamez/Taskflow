"""Derivacion pura del `key` corto de un proyecto (ej. "TASK" en "TASK-123").

Sin ORM a proposito: usado tanto desde el serializer (creacion en vivo,
`taken` viene de una query sobre el workspace) como desde la migracion de
backfill (`apps.projects.backfill`, `taken` se arma en memoria por
workspace). Mantenerlo puro hace que ambos call sites compartan
exactamente la misma logica de derivacion/desambiguacion sin duplicarla.
"""

from __future__ import annotations

import re
import unicodedata

MAX_KEY_LENGTH = 10
FALLBACK_KEY = "TASK"


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def _candidate_from_words(words: list[str]) -> str:
    """Iniciales de cada palabra (ej. ["Task", "Flow", "App"] -> "TFA")."""
    initials = "".join(word[0] for word in words if word)
    return initials.upper()


def _candidate_from_single_word(word: str) -> str:
    """Primeras letras del nombre (ej. "Marketing" -> "MARKETING"[:10])."""
    return word.upper()


def _base_candidate(name: str) -> str:
    normalized = _strip_accents(name)
    words = re.findall(r"[A-Za-z0-9]+", normalized)

    if not words:
        return ""

    if len(words) == 1:
        candidate = _candidate_from_single_word(words[0])
    else:
        candidate = _candidate_from_words(words)
        if len(candidate) < 2:
            # Palabras con inicial no alfanumerica util (raro, pero posible
            # con nombres muy cortos) -- caemos al nombre de la primera
            # palabra en vez de un key de una sola letra.
            candidate = _candidate_from_single_word(words[0])

    candidate = re.sub(r"[^A-Z0-9]", "", candidate)
    candidate = candidate[:MAX_KEY_LENGTH]

    if not candidate or not candidate[0].isalpha():
        return ""

    return candidate


def derive_project_key(name: str, taken: set[str]) -> str:
    """Deriva un key corto `[A-Z][A-Z0-9]{0,9}` desde `name`, unico dentro de
    `taken` (case-sensitive, ya en mayusculas). Si el nombre no da nada
    usable (vacio, solo simbolos), usa `"TASK"` como base. Colisiones se
    resuelven agregando un sufijo numerico creciente (`TASK`, `TASK2`,
    `TASK3`, ...), respetando siempre el largo maximo de 10 caracteres.
    """
    base = _base_candidate(name) or FALLBACK_KEY

    if base not in taken:
        return base

    suffix = 2
    while True:
        suffix_str = str(suffix)
        truncated_base = base[: MAX_KEY_LENGTH - len(suffix_str)]
        candidate = f"{truncated_base}{suffix_str}"
        if candidate not in taken:
            return candidate
        suffix += 1
