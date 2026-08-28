"""Reglas de jerarquia de `Page`, aisladas de las vistas HTTP y de la DB
(docs/PHASE_4_PLAN.md D12).

Es el modulo mas critico de la feature: un bug aca produce un bucle
infinito real, ya sea en el servidor (recorriendo `parent` sin cortar) o
en el render del arbol del sidebar. Por eso las tres funciones son puras
y reciben `parent_by_id: dict[UUID, UUID | None]` inyectado -- el
llamador hace una sola query (`Page.objects.filter(workspace=...)
.values_list("id", "parent_id")`) y estas funciones nunca tocan la DB.

`MAX_PAGE_DEPTH` (D13) es a la vez un limite de recursos y el tope de
seguridad que corta el walk incluso si `parent_by_id` ya estuviera
corrupto (un ciclo A->B->A en la data, algo que en teoria no deberia
poder ocurrir gracias a `would_create_cycle`, pero el walk no debe
colgarse si ocurre de todos modos).
"""

from __future__ import annotations

import uuid

MAX_PAGE_DEPTH = 5


def resolve_ancestor_ids(
    page_id: uuid.UUID,
    parent_by_id: dict[uuid.UUID, uuid.UUID | None],
    max_depth: int = MAX_PAGE_DEPTH,
) -> list[uuid.UUID]:
    """Devuelve los ids de los ancestros de `page_id`, del padre mas
    cercano al mas lejano, caminando `parent_by_id` hacia arriba.

    Nunca incluye a `page_id` mismo. Corta en `max_depth` pasos pase lo
    que pase -- es la red de seguridad contra data corrupta ciclica
    (RP-4): sin este tope, un ciclo en `parent_by_id` haria loop infinito.
    """
    ancestors: list[uuid.UUID] = []
    current = parent_by_id.get(page_id)

    while current is not None and len(ancestors) < max_depth:
        ancestors.append(current)
        current = parent_by_id.get(current)

    return ancestors


def would_create_cycle(
    page_id: uuid.UUID,
    new_parent_id: uuid.UUID | None,
    parent_by_id: dict[uuid.UUID, uuid.UUID | None],
    max_depth: int = MAX_PAGE_DEPTH,
) -> bool:
    """True si asignarle `new_parent_id` como padre a `page_id` crearia un
    ciclo (RP-3): auto-padre (A->A), ciclo directo (A->B->A) o transitivo
    (A->B->C->A) -- mover una pagina debajo de uno de sus propios
    descendientes.

    Se resuelve caminando los ancestros de `new_parent_id`: si `page_id`
    aparece entre ellos, moverla ahi la volveria su propio descendiente.
    """
    if new_parent_id is None:
        return False

    if new_parent_id == page_id:
        return True

    ancestors_of_new_parent = resolve_ancestor_ids(new_parent_id, parent_by_id, max_depth)
    return page_id in ancestors_of_new_parent


def compute_depth(
    parent_id: uuid.UUID | None,
    parent_by_id: dict[uuid.UUID, uuid.UUID | None],
) -> int:
    """Profundidad que tendria una pagina (nueva o movida) cuyo padre sea
    `parent_id`. Una pagina raiz (`parent_id is None`) esta en el nivel 0.

    Se usa para el tope de D13 (`MAX_PAGE_DEPTH` niveles): un `parent_id`
    en el nivel `MAX_PAGE_DEPTH - 1` produciria una pagina en el nivel
    `MAX_PAGE_DEPTH`, que es exactamente el nivel que hay que rechazar.
    """
    if parent_id is None:
        return 0

    return 1 + len(resolve_ancestor_ids(parent_id, parent_by_id))
