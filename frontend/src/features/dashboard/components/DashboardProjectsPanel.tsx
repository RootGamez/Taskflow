import { FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "@/components/ui/shadcn/card";
import { summarizeProgress } from "@/features/dashboard/lib/dashboardMetrics";
import type { Project } from "@/features/projects/types/project.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface DashboardProjectsPanelProps {
  workspaceSlug: string;
  projects: Project[];
  ticketsByProjectId: Record<string, Ticket[]>;
  doneStatusIds: ReadonlySet<string>;
  isLoading?: boolean;
  hasWorkspace: boolean;
}

/**
 * "Proyectos" (docs/BRUTALIST_REDESIGN_PLAN.md §10): lista de proyectos del
 * espacio actual con una mini barra de progreso por proyecto
 * (tickets completados / totales, calculado sobre las queries de tickets ya
 * cargadas en el dashboard).
 */
export function DashboardProjectsPanel({
  workspaceSlug,
  projects,
  ticketsByProjectId,
  doneStatusIds,
  isLoading = false,
  hasWorkspace,
}: DashboardProjectsPanelProps) {
  const visibleProjects = projects.filter((project) => !project.is_archived);

  return (
    <Card className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-3">
        <div>
          <p className="eyebrow">Proyectos</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Progreso por tablero del espacio actual.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {visibleProjects.length}
        </span>
      </header>

      <div className="p-2">
        {visibleProjects.length > 0 ? (
          <ul className="divide-y divide-border">
            {visibleProjects.map((project) => {
              const tickets = ticketsByProjectId[project.id] ?? [];
              const { completed, total, percent } = summarizeProgress(tickets, doneStatusIds);
              return (
                <li key={project.id}>
                  <Link
                    to={`/workspaces/${workspaceSlug}/projects/${project.id}/board`}
                    className="flex flex-col gap-2 rounded px-2 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="boxed-icon h-4 w-4 shrink-0"
                          style={{ backgroundColor: project.color }}
                          aria-hidden
                        />
                        <span className="truncate text-sm font-medium text-foreground">
                          {project.name}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {completed}/{total}
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full border border-border bg-muted"
                      role="progressbar"
                      aria-valuenow={completed}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-label={`Progreso de ${project.name}`}
                    >
                      <div
                        className="h-full bg-primary transition-[width]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : isLoading ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Cargando proyectos…</p>
        ) : (
          <div className="m-2 flex flex-col items-center gap-2 rounded border-2 border-dashed border-border p-6 text-center">
            <span className="boxed-icon h-9 w-9 border-dashed text-muted-foreground">
              <FolderOpen className="h-4 w-4" />
            </span>
            <p className="text-sm text-muted-foreground">
              {hasWorkspace
                ? "No hay proyectos todavía. Crea el primero para empezar a organizar tickets."
                : "No tienes espacios todavía. Crea uno para empezar o acepta una invitación pendiente."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
