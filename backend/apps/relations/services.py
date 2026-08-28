"""Funciones puras de `apps.relations` (WP-C, Fase 3).

Nucleo testeable de la feature (docs/PHASE_3_PLAN.md, D38/D39/D61): ninguna
de las dos funciones toca Django ni la DB. `normalize_relation` decide como
guardar un POST; `resolve_relation_type` decide como leer una fila
existente. Separarlas de `serializers.py`/`views.py` permite testearlas sin
`APITestCase` (ver `test_services.py`).
"""

from __future__ import annotations

from typing import TypeVar

T = TypeVar("T")

# Los unicos 3 valores que viven en la DB (D38). `blocked_by`/`duplicated_by`
# son azucar de UX que la API acepta en el POST y normaliza invirtiendo
# `from`/`to` -- si se guardaran tal cual, "A blocked_by B" y "B blocks A"
# serian dos filas distintas que significan lo mismo, un estado
# contradictorio que la constraint de unicidad de la DB no podria detectar.
STORED_TYPES = frozenset({"blocks", "relates_to", "duplicate_of"})

# Los 5 valores que acepta el POST (D38): los 3 almacenables + los 2 que se
# normalizan invirtiendo la direccion.
ALLOWED_INPUT_TYPES = frozenset({"blocks", "blocked_by", "relates_to", "duplicate_of", "duplicated_by"})

# Etiqueta con la que se lee un tipo almacenable desde el lado `to_ticket`
# de la fila (D39). `relates_to` no aparece aca porque es simetrico: se lee
# igual desde cualquiera de los dos extremos.
_INVERSE_STORED_LABEL = {
    "blocks": "blocked_by",
    "duplicate_of": "duplicated_by",
}


def normalize_relation(current: T, other: T, relation_type: str) -> tuple[T, T, str]:
    """Normaliza el payload de un POST a su forma canonica de DB.

    Funcion pura (D38): `current`/`other` pueden ser instancias de
    `Ticket`, UUIDs, o cualquier otro identificador -- esta funcion solo
    decide el ORDEN (`from_ticket`/`to_ticket`) y el `stored_type`, nunca
    los resuelve contra la base de datos.

    - `blocks` / `relates_to` / `duplicate_of` ya son su propia forma
      canonica: se guardan tal cual, en el mismo orden recibido.
    - `blocked_by` se invierte a "other blocks current".
    - `duplicated_by` se invierte a "other duplicate_of current".

    Levanta `ValueError` para cualquier valor fuera de los 5 aceptados --
    en la API real esto no deberia poder pasar (el `ChoiceField` del
    serializer ya restringe el input), pero la funcion es defensiva por
    contrato al ser reutilizable fuera de ese contexto.
    """
    if relation_type not in ALLOWED_INPUT_TYPES:
        raise ValueError(f"Tipo de relacion invalido: {relation_type!r}")

    if relation_type == "blocked_by":
        return other, current, "blocks"
    if relation_type == "duplicated_by":
        return other, current, "duplicate_of"

    return current, other, relation_type


def resolve_relation_type(row, ticket_id) -> str:
    """Resuelve la etiqueta de una fila de `TicketRelation` vista desde
    `ticket_id` (D39).

    Funcion pura: `row` solo necesita exponer `from_ticket_id`,
    `to_ticket_id` y `relation_type` como atributos -- no dispara queries
    nuevas (a diferencia de acceder a `row.from_ticket`/`row.to_ticket`,
    que si resolverian el FK). Acepta cualquier objeto duck-typed con esos
    3 atributos, no solo instancias reales del modelo -- por eso
    `test_services.py` la testea con un `SimpleNamespace`, sin DB.

    `relates_to` se lee igual en ambas direcciones. `blocks`/`duplicate_of`
    se invierten (`blocked_by`/`duplicated_by`) cuando `ticket_id` es el
    lado `to_ticket` de la fila (la relacion "le llega" al ticket
    consultado, en vez de "salir" de el).
    """
    if row.relation_type == "relates_to":
        return "relates_to"

    is_incoming = str(row.to_ticket_id) == str(ticket_id)
    if is_incoming:
        return _INVERSE_STORED_LABEL.get(row.relation_type, row.relation_type)
    return row.relation_type
