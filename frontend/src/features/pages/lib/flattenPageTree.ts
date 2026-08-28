import type { PageTreeNode } from "@/features/pages/lib/buildPageTree";
import type { PageSummary } from "@/features/pages/types/page.types";

export interface FlatPageTreeItem extends PageSummary {
  depth: number;
  hasChildren: boolean;
}

/**
 * Aplana el arbol de `buildPageTree` a una lista lineal depth-first, apta
 * para renderizar `PageTreeNav` como una lista de `<li>` indentados en vez
 * de un componente recursivo (docs/PHASE_4_PLAN.md seccion 4.5, tests
 * 50-51). Los hijos de un nodo colapsado ni siquiera se agregan a la
 * lista -- no es un `display:none`, es que nunca se recorren.
 */
export function flattenPageTree(
  nodes: PageTreeNode[],
  collapsedIds: ReadonlySet<string> = new Set(),
  depth = 0,
): FlatPageTreeItem[] {
  const result: FlatPageTreeItem[] = [];

  for (const node of nodes) {
    const { children, ...page } = node;
    const hasChildren = children.length > 0;

    result.push({ ...page, depth, hasChildren });

    if (hasChildren && !collapsedIds.has(node.id)) {
      result.push(...flattenPageTree(children, collapsedIds, depth + 1));
    }
  }

  return result;
}
