import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import type { ProjectTaskGroup } from "@/features/mytasks/utils/groupTasksByProject";

interface MyTasksProjectGroupProps {
  group: ProjectTaskGroup;
  onOpenTask: (task: MyTask) => void;
}

/**
 * Una seccion de "Mis tareas" por proyecto: header (color + nombre) y las
 * tarjetas de sus tareas. Reusa `TicketCard` tal cual (D33) -- nunca
 * reimplementa su markup.
 *
 * D34: `TicketCard.tsx` esta siendo modificado en paralelo por el agente de
 * labels. Los tests de este componente NO pueden asertar sobre su DOM
 * interno -- solo por `ticket.title` / `getAllByRole("button")`.
 */
export function MyTasksProjectGroup({ group, onOpenTask }: MyTasksProjectGroupProps) {
  return (
    <section className="space-y-3" aria-label={group.project.name}>
      {/* Header de grupo en formato "carpeta" (§11): mayúsculas + borde
          inferior grueso, como la pestaña de un dossier. */}
      <div className="flex items-center gap-2 border-b-2 border-border pb-2">
        <span
          className="boxed-icon h-3.5 w-3.5 shrink-0"
          style={{ backgroundColor: group.project.color }}
          data-testid="my-tasks-project-color"
          aria-hidden
        />
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-foreground">
          {group.project.name}
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {group.tasks.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.tasks.map((task) => (
          <TicketCard key={task.id} ticket={task} onOpen={() => onOpenTask(task)} />
        ))}
      </div>
    </section>
  );
}
