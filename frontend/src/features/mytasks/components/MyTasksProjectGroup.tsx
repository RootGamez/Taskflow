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
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.project.color }}
          data-testid="my-tasks-project-color"
        />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{group.project.name}</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{group.tasks.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.tasks.map((task) => (
          <TicketCard key={task.id} ticket={task} onOpen={() => onOpenTask(task)} />
        ))}
      </div>
    </section>
  );
}
