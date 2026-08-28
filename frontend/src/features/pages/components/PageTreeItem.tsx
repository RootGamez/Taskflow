import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

const INDENT_PER_LEVEL_PX = 12;
const BASE_INDENT_PX = 8;

export interface PageTreeItemProps {
  workspaceSlug: string;
  pageId: string;
  title: string;
  icon: string;
  childCount: number;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/**
 * Fila del arbol de paginas (D18 de docs/PHASE_4_PLAN.md): chevron solo si
 * tiene hijos, icono o `FileText` de fallback, indentado por nivel, activa
 * con `bg-brand-50 font-medium text-brand-700` (mismo patron que
 * `Sidebar.tsx:79`).
 */
export function PageTreeItem({
  workspaceSlug,
  pageId,
  title,
  icon,
  childCount,
  depth,
  isActive,
  isExpanded,
  onToggleExpand,
}: PageTreeItemProps) {
  const hasChildren = childCount > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-md py-1.5 pr-2 text-sm",
        isActive
          ? "bg-brand-50 font-medium text-brand-700"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
      style={{ paddingLeft: `${depth * INDENT_PER_LEVEL_PX + BASE_INDENT_PX}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          aria-label={isExpanded ? "Colapsar" : "Expandir"}
          onClick={onToggleExpand}
          className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400"
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}

      <Link
        to={`/workspaces/${workspaceSlug}/pages/${pageId}`}
        className="flex min-w-0 flex-1 items-center gap-1.5 truncate"
      >
        {icon ? <span className="shrink-0">{icon}</span> : <FileText className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{title}</span>
      </Link>
    </div>
  );
}
