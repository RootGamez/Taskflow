import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/shadcn/badge";
import { Card } from "@/components/ui/shadcn/card";
import { useMyTasks } from "@/features/mytasks/hooks/useMyTasks";
import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Priority } from "@/features/tickets/types/ticket.types";

const URGENT_PRIORITIES: ReadonlySet<Priority> = new Set<Priority>(["urgent", "high"]);
const MAX_VISIBLE = 6;

/**
 * "Mis tickets urgentes" (docs/BRUTALIST_REDESIGN_PLAN.md §10): reemplaza
 * "Últimos tickets vistos" por algo accionable — mis tareas asignadas
 * (`useMyTasks`, Fase 2) filtradas a prioridad `urgent | high`, en el orden
 * que ya resuelve el backend (vencidos primero).
 */
export function UrgentTicketsPanel() {
  const { data: tasks = [], isLoading } = useMyTasks();
  const urgentTasks = tasks
    .filter((task) => URGENT_PRIORITIES.has(task.priority))
    .slice(0, MAX_VISIBLE);

  return (
    <Card className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-3">
        <p className="eyebrow">Mis tickets urgentes</p>
        <span className="boxed-icon h-8 w-8 text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
        </span>
      </header>

      <div className="p-2">
        {urgentTasks.length > 0 ? (
          <ul className="divide-y divide-border">
            {urgentTasks.map((task) => {
              const priority = PRIORITY_STYLES[task.priority];
              const PriorityIcon = priority.Icon;
              return (
                <li key={task.id}>
                  <Link
                    to={`/tickets/${task.id}`}
                    className="flex items-center gap-3 rounded px-2 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PriorityIcon className={`h-4 w-4 shrink-0 ${priority.textClass}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {task.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {task.project.name}
                      </span>
                    </span>
                    {task.reference ? (
                      <Badge variant="secondary" mono className="shrink-0">
                        {task.reference}
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : isLoading ? (
          <p className="px-2 py-6 text-sm text-muted-foreground">Cargando tickets…</p>
        ) : (
          <p className="px-2 py-6 text-sm text-muted-foreground">
            No tienes tickets urgentes ni de prioridad alta asignados.
          </p>
        )}
      </div>
    </Card>
  );
}
