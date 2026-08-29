import { Rocket } from "lucide-react";

import { daysRemaining, progressPercent } from "@/features/sprints/utils/sprintProgress";
import type { Sprint } from "@/features/sprints/types/sprint.types";

interface SprintSummaryCardProps {
  sprint: Sprint | null;
  now?: Date;
}

/**
 * Card compacta de resumen del sprint activo (DESIGN_SYSTEM.md §8.1): nombre
 * + meta, `{completados}/{total} completados`, dias restantes, y una barra
 * de progreso simple (`bg-muted` + relleno `bg-primary`, 6px). Sin chart de
 * burndown en v1 (D22, YAGNI).
 *
 * Devuelve `null` cuando no hay un sprint que resumir (p. ej. scope "all" /
 * "backlog", o un proyecto sin sprint activo).
 */
export function SprintSummaryCard({ sprint, now = new Date() }: SprintSummaryCardProps) {
  if (!sprint) {
    return null;
  }

  const percent = progressPercent(sprint.completed_ticket_count, sprint.ticket_count);
  const remaining = daysRemaining(sprint.end_date, now);
  const isOverdue = remaining < 0;
  const remainingLabel = isOverdue
    ? `Finalizo hace ${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? "" : "s"}`
    : remaining === 0
      ? "Finaliza hoy"
      : `${remaining} dia${remaining === 1 ? "" : "s"} restantes`;

  return (
    <div className="border-2 border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="boxed-icon h-6 w-6 shrink-0 text-primary">
            <Rocket className="h-3.5 w-3.5" />
          </span>
          <span className="truncate font-display text-sm font-bold text-foreground">{sprint.name}</span>
          {sprint.goal ? (
            <span className="truncate text-xs text-muted-foreground">· {sprint.goal}</span>
          ) : null}
        </div>
        <span
          className={`shrink-0 font-mono text-xs tabular-nums ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
        >
          {remainingLabel}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-muted">
          <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {sprint.completed_ticket_count}/{sprint.ticket_count} completados
        </span>
      </div>
    </div>
  );
}
