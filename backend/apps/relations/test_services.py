"""Tests de `apps.relations.services` (WP-C, Fase 3).

Pytest plano, sin DB -- mismo patron que `apps/labels/test_palette.py` /
`apps/tickets/test_rich_text.py`. `normalize_relation` y
`resolve_relation_type` son funciones puras (D38/D39/D61 de
docs/PHASE_3_PLAN.md): no tocan Django ni la DB, asi que se testean con
objetos livianos en vez de instancias reales de `Ticket`/`TicketRelation`.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from apps.relations.services import normalize_relation, resolve_relation_type

CURRENT = "current-ticket-id"
OTHER = "other-ticket-id"


def _row(from_ticket_id: str, to_ticket_id: str, relation_type: str) -> SimpleNamespace:
    return SimpleNamespace(from_ticket_id=from_ticket_id, to_ticket_id=to_ticket_id, relation_type=relation_type)


# -- normalize_relation -----------------------------------------------------


def test_normalize_blocks_keeps_direction():
    from_ticket, to_ticket, stored_type = normalize_relation(CURRENT, OTHER, "blocks")

    assert (from_ticket, to_ticket, stored_type) == (CURRENT, OTHER, "blocks")


def test_normalize_blocked_by_flips_direction_and_stores_blocks():
    from_ticket, to_ticket, stored_type = normalize_relation(CURRENT, OTHER, "blocked_by")

    # "current blocked_by other" == "other blocks current" -- D38.
    assert (from_ticket, to_ticket, stored_type) == (OTHER, CURRENT, "blocks")


def test_normalize_duplicated_by_flips_direction_and_stores_duplicate_of():
    from_ticket, to_ticket, stored_type = normalize_relation(CURRENT, OTHER, "duplicated_by")

    assert (from_ticket, to_ticket, stored_type) == (OTHER, CURRENT, "duplicate_of")


def test_normalize_relates_to_keeps_direction():
    from_ticket, to_ticket, stored_type = normalize_relation(CURRENT, OTHER, "relates_to")

    assert (from_ticket, to_ticket, stored_type) == (CURRENT, OTHER, "relates_to")


def test_normalize_rejects_an_unknown_relation_type():
    with pytest.raises(ValueError):
        normalize_relation(CURRENT, OTHER, "duplicate_ofx")


# -- resolve_relation_type ----------------------------------------------------


def test_resolve_type_outgoing_blocks_reads_as_blocks():
    row = _row(from_ticket_id=CURRENT, to_ticket_id=OTHER, relation_type="blocks")

    assert resolve_relation_type(row, CURRENT) == "blocks"


def test_resolve_type_incoming_blocks_reads_as_blocked_by():
    row = _row(from_ticket_id=OTHER, to_ticket_id=CURRENT, relation_type="blocks")

    assert resolve_relation_type(row, CURRENT) == "blocked_by"


def test_resolve_type_incoming_duplicate_of_reads_as_duplicated_by():
    row = _row(from_ticket_id=OTHER, to_ticket_id=CURRENT, relation_type="duplicate_of")

    assert resolve_relation_type(row, CURRENT) == "duplicated_by"


def test_resolve_type_relates_to_is_symmetric_in_both_directions():
    outgoing = _row(from_ticket_id=CURRENT, to_ticket_id=OTHER, relation_type="relates_to")
    incoming = _row(from_ticket_id=OTHER, to_ticket_id=CURRENT, relation_type="relates_to")

    assert resolve_relation_type(outgoing, CURRENT) == "relates_to"
    assert resolve_relation_type(incoming, CURRENT) == "relates_to"
