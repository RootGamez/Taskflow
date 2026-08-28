import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";

import type { PageBreadcrumbEntry } from "@/features/pages/types/page.types";

interface PageBreadcrumbProps {
  workspaceSlug: string;
  breadcrumb: PageBreadcrumbEntry[];
}

/**
 * D18: `text-xs text-muted-foreground` con `ChevronRight` entre crumbs.
 * Una pagina raiz no tiene ancestros -- `breadcrumb` llega vacio y el
 * componente no renderiza nada (evita un contenedor vacio con padding).
 */
export function PageBreadcrumb({ workspaceSlug, breadcrumb }: PageBreadcrumbProps) {
  if (breadcrumb.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground" aria-label="Breadcrumb">
      {breadcrumb.map((crumb, index) => (
        <Fragment key={crumb.id}>
          {index > 0 ? <ChevronRight className="h-3 w-3 shrink-0" /> : null}
          <Link
            to={`/workspaces/${workspaceSlug}/pages/${crumb.id}`}
            className="flex items-center gap-1 truncate hover:text-foreground"
          >
            {crumb.icon ? <span>{crumb.icon}</span> : null}
            <span className="truncate">{crumb.title}</span>
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
