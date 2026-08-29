"""Tests de las funciones puras de jerarquia de `apps/pages/services.py`
(docs/PHASE_4_PLAN.md D12, seccion 4.5, tests 1-9).

Sin DB a proposito (patron `apps/labels/test_palette.py`): `parent_by_id`
se construye a mano como un `dict[UUID, UUID | None]`, exactamente la forma
que produce `Page.objects.filter(workspace=...).values_list("id",
"parent_id")` en el view real (una sola query, D12). Esto es lo que
permite testear el unico punto de la feature donde un bug produce un
bucle infinito (RP-3/RP-4) sin levantar Postgres.
"""

from __future__ import annotations

import uuid

from apps.pages.services import (
    MAX_PAGE_DEPTH,
    compute_depth,
    resolve_ancestor_ids,
    would_create_cycle,
)


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def test_resolve_ancestor_ids_returns_empty_for_a_root_page():
    root = _uuid()
    parent_by_id = {root: None}

    assert resolve_ancestor_ids(root, parent_by_id) == []


def test_resolve_ancestor_ids_walks_up_the_chain():
    root, child, grandchild = _uuid(), _uuid(), _uuid()
    parent_by_id = {root: None, child: root, grandchild: child}

    assert resolve_ancestor_ids(grandchild, parent_by_id) == [child, root]


def test_resolve_ancestor_ids_stops_at_max_depth():
    # Cadena ciclica corrupta (A->B->A): sin el tope de profundidad esto es
    # un loop infinito real en el servidor (RP-4). El walk debe cortar en
    # MAX_PAGE_DEPTH en vez de colgarse.
    a, b = _uuid(), _uuid()
    parent_by_id = {a: b, b: a}

    result = resolve_ancestor_ids(a, parent_by_id)

    assert len(result) == MAX_PAGE_DEPTH


def test_would_create_cycle_detects_self_parent():
    page = _uuid()
    parent_by_id = {page: None}

    assert would_create_cycle(page, page, parent_by_id) is True


def test_would_create_cycle_detects_a_direct_cycle():
    a, b = _uuid(), _uuid()
    # b es hijo de a. Mover a (page_id) debajo de b (new_parent_id) es un
    # ciclo directo de 2 (A->B->A).
    parent_by_id = {a: None, b: a}

    assert would_create_cycle(a, b, parent_by_id) is True


def test_would_create_cycle_detects_a_transitive_cycle():
    a, b, c = _uuid(), _uuid(), _uuid()
    # a (raiz) -> b (hijo de a) -> c (hijo de b). Mover a debajo de su
    # propio nieto c es un ciclo transitivo de 3.
    parent_by_id = {a: None, b: a, c: b}

    assert would_create_cycle(a, c, parent_by_id) is True


def test_would_create_cycle_is_false_for_a_sibling_move():
    root, sibling_a, sibling_b = _uuid(), _uuid(), _uuid()
    parent_by_id = {root: None, sibling_a: root, sibling_b: root}

    assert would_create_cycle(sibling_a, sibling_b, parent_by_id) is False


def test_compute_depth_counts_ancestors():
    root, child = _uuid(), _uuid()
    parent_by_id = {root: None, child: root}

    # Una pagina nueva cuyo padre fuera `child` quedaria en el nivel 2
    # (root=0, child=1, nueva=2).
    assert compute_depth(child, parent_by_id) == 2


def test_compute_depth_is_zero_for_a_root_page():
    assert compute_depth(None, {}) == 0
