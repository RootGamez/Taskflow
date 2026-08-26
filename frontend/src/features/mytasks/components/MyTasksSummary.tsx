import { isDueDateOverdue } from "@/features/tickets/utils/dueDate";
import type { MyTask } from "@/features/mytasks/types/myTask.types";

interface MyTasksSummaryProps {
  tasks: readonly MyTask[];
  now?: Date;
}

/**
 * Resumen textual arriba de la lista agrupada: total de tareas asignadas +
 * cuantas estan vencidas (si hay alguna). `now` es inyectable por default
 * (D10) para que el test de "vencidas" sea determinista sin
 * `vi.useFakeTimers()`.
 */
export function MyTasksSummary({ tasks, now = new Date() }: MyTasksSummaryProps) {
  if (tasks.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No tienes tareas asignadas.</p>;
  }

  const overdueCount = tasks.filter((task) => isDueDateOverdue(task.due_date, now)).length;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span data-testid="my-tasks-summary-total" className="text-zinc-600 dark:text-zinc-300">
        {tasks.length} tareas asignadas
      </span>
      {overdueCount > 0 ? (
        <span data-testid="my-tasks-summary-overdue" className="text-destructive">
          {overdueCount} vencidas
        </span>
      ) : null}
    </div>
  );
}
