import type { PageSummary } from "@/features/pages/types/page.types";

export interface PageTreeNode extends PageSummary {
  children: PageTreeNode[];
}

/**
 * Mismo tope que `MAX_PAGE_DEPTH` en `apps/pages/services.py` (D13). No es
 * una validacion de negocio (esa vive en el backend, que ya impide crear
 * data mas profunda que esto) -- es la red de seguridad del renderer del
 * sidebar (RP-4): si la data llegara corrupta igual, el arbol nunca se
 * cuelga ni se dibuja infinitamente profundo.
 */
const MAX_TREE_DEPTH = 5;

/**
 * Arma el arbol de paginas a partir de la lista plana (`PageSummary[]`,
 * D11 -- nunca trae `content`). Puro, sin llamadas a red (docs/PHASE_4_
 * PLAN.md seccion 4.5, tests 44-49).
 *
 * Robusto ante data corrupta (RP-4), que en teoria no deberia poder
 * ocurrir gracias a `would_create_cycle` en el backend, pero el renderer
 * no debe confiar ciegamente en eso:
 * - Un `parent_id` que no aparece en la lista (pagina padre de otro
 *   workspace, o ya borrada) promueve la pagina a la raiz en vez de
 *   descartarla.
 * - Un ciclo (A->B->A) nunca se recorre dos veces: cada id se visita una
 *   sola vez en todo el arbol. Los nodos que nunca son alcanzados desde
 *   una raiz real (porque su unica cadena hacia arriba es ciclica) se
 *   promueven a la raiz al final, en vez de desaparecer en silencio.
 * - Mas alla de `maxDepth` niveles, se corta: los nodos mas profundos se
 *   marcan como visitados (para no reaparecer promovidos) pero no se
 *   incluyen en el arbol.
 */
export function buildPageTree(pages: PageSummary[], maxDepth: number = MAX_TREE_DEPTH): PageTreeNode[] {
  const byId = new Map(pages.map((page) => [page.id, page] as const));
  const childrenByParentId = new Map<string, PageSummary[]>();

  for (const page of pages) {
    if (page.parent_id && byId.has(page.parent_id)) {
      const siblings = childrenByParentId.get(page.parent_id) ?? [];
      siblings.push(page);
      childrenByParentId.set(page.parent_id, siblings);
    }
  }

  const sortSiblings = (list: PageSummary[]): PageSummary[] =>
    [...list].sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at));

  const visited = new Set<string>();

  function markDescendantsVisited(pageId: string): void {
    for (const child of childrenByParentId.get(pageId) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      markDescendantsVisited(child.id);
    }
  }

  function attachChildren(page: PageSummary, depth: number): PageTreeNode {
    visited.add(page.id);

    if (depth >= maxDepth) {
      markDescendantsVisited(page.id);
      return { ...page, children: [] };
    }

    const children = sortSiblings(childrenByParentId.get(page.id) ?? [])
      .filter((child) => !visited.has(child.id))
      .map((child) => attachChildren(child, depth + 1));

    return { ...page, children };
  }

  const realRoots = pages.filter((page) => !page.parent_id || !byId.has(page.parent_id));
  const tree = sortSiblings(realRoots).map((page) => attachChildren(page, 0));

  const strandedCandidates = sortSiblings(pages.filter((page) => !visited.has(page.id)));
  const strandedTree: PageTreeNode[] = [];
  for (const page of strandedCandidates) {
    if (visited.has(page.id)) continue;
    strandedTree.push(attachChildren(page, 0));
  }

  return [...tree, ...strandedTree];
}
