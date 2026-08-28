import { ListChecks } from "lucide-react";

import { SubtaskComposer } from "@/features/subtasks/components/SubtaskComposer";
import { SubtaskItem } from "@/features/subtasks/components/SubtaskItem";
import { SubtaskProgressBar } from "@/features/subtasks/components/SubtaskProgressBar";
import {
  useCreateSubtask,
  useDeleteSubtask,
  useSubtasks,
  useToggleSubtask,
} from "@/features/subtasks/hooks/useSubtasks";

export interface TicketSubtasksSectionProps {
  ticketId: string;
  projectId: string;
  canEdit: boolean;
}

/**
 * Seccion de subtareas/checklist del detalle del ticket (WP-B, Fase 3).
 *
 * Autosuficiente (D5 del plan tecnico, mismo patron que `TicketLabelsRow`):
 * llama sus propios hooks en vez de recibir callbacks desde `TicketDetail`.
 * D33: `subtask.assignee` se implementa/testea en la API pero no se
 * renderiza aca -- ningun selector de responsable en v1.
 */
export function TicketSubtasksSection({ ticketId, projectId, canEdit }: TicketSubtasksSectionProps) {
  const { data: subtasks = [] } = useSubtasks(projectId, ticketId);
  const createSubtask = useCreateSubtask(projectId, ticketId);
  const toggleSubtask = useToggleSubtask(projectId, ticketId);
  const deleteSubtask = useDeleteSubtask(projectId, ticketId);

  const doneCount = subtasks.filter((subtask) => subtask.is_done).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Subtareas</span>
      </div>

      <SubtaskProgressBar done={doneCount} total={subtasks.length} />

      {subtasks.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">No hay subtareas todavia.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {subtasks.map((subtask) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              canEdit={canEdit}
              onToggle={(isDone) => toggleSubtask.mutate({ subtaskId: subtask.id, isDone })}
              onDelete={() => deleteSubtask.mutate(subtask.id)}
            />
          ))}
        </ul>
      )}

      {canEdit ? (
        <SubtaskComposer
          onSubmit={(title) => createSubtask.mutate({ title })}
          isSubmitting={createSubtask.isPending}
        />
      ) : null}
    </div>
  );
}
