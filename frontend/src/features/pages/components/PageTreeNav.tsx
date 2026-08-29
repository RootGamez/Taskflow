import { useState } from "react";
import { useLocation } from "react-router-dom";

import { buildPageTree, type PageTreeNode } from "@/features/pages/lib/buildPageTree";
import { flattenPageTree } from "@/features/pages/lib/flattenPageTree";
import { PageTreeItem } from "@/features/pages/components/PageTreeItem";
import { usePages } from "@/features/pages/hooks/usePages";
import { useUIStore } from "@/store/uiStore";

interface PageTreeNavProps {
  workspaceSlug: string;
}

function collectExpandableIds(nodes: PageTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.children.length > 0
      ? [node.id, ...collectExpandableIds(node.children)]
      : collectExpandableIds(node.children),
  );
}

/**
 * Arbol de paginas del sidebar (D18 de docs/PHASE_4_PLAN.md). Cada nodo
 * con hijos arranca colapsado ("colapsado por defecto") -- `expandedIds`
 * es un opt-in, nunca al reves, asi que abrir el sidebar por primera vez
 * en un workspace con mucha documentacion no vuelca todo el arbol.
 *
 * Verifica `sidebarCollapsed` por su cuenta (ademas del gate que ya hace
 * `Sidebar.tsx` al montarlo, WP-0A) como defensa redundante: este
 * componente no deberia asumir que siempre lo van a montar condicionado.
 */
export function PageTreeNav({ workspaceSlug }: PageTreeNavProps) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const location = useLocation();
  const { data: pages } = usePages(workspaceSlug);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (sidebarCollapsed) {
    return null;
  }

  const tree = buildPageTree(pages ?? []);

  if (tree.length === 0) {
    return <p className="px-2 py-1.5 text-xs text-zinc-400">Sin páginas todavía.</p>;
  }

  const expandableIds = collectExpandableIds(tree);
  const collapsedIds = new Set(expandableIds.filter((id) => !expandedIds.has(id)));
  const flatItems = flattenPageTree(tree, collapsedIds);

  function toggleExpanded(pageId: string): void {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }

  return (
    <nav aria-label="Páginas" className="space-y-0.5">
      {flatItems.map((item) => (
        <PageTreeItem
          key={item.id}
          workspaceSlug={workspaceSlug}
          pageId={item.id}
          title={item.title}
          icon={item.icon}
          childCount={item.child_count}
          depth={item.depth}
          isActive={location.pathname === `/workspaces/${workspaceSlug}/pages/${item.id}`}
          isExpanded={expandedIds.has(item.id)}
          onToggleExpand={() => toggleExpanded(item.id)}
        />
      ))}
    </nav>
  );
}
