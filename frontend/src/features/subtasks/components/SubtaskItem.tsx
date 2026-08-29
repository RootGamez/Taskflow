import { X } from "lucide-react";

import type { SubTask } from "@/features/subtasks/types/subtask.types";

interface SubtaskItemProps {
  subtask: SubTask;
  canEdit: boolean;
  onToggle: (isDone: boolean) => void;
  onDelete: () => void;
}

/**
 * Fila individual del checklist de subtareas. Presentacional puro (D33: sin
 * selector de responsable -- `subtask.assignee` no se renderiza en v1).
 */
export function SubtaskItem({ subtask, canEdit, onToggle, onDelete }: SubtaskItemProps) {
  return (
    <li className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
      <input
        type="checkbox"
        checked={subtask.is_done}
        disabled={!canEdit}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={`Marcar "${subtask.title}" como ${subtask.is_done ? "pendiente" : "hecha"}`}
      />
      <span
        className={`flex-1 text-sm ${
          subtask.is_done ? "text-muted-foreground line-through" : "text-foreground"
        }`}
      >
        {subtask.title}
      </span>
      {canEdit ? (
        <button
          type="button"
          aria-label="Eliminar subtarea"
          onClick={onDelete}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </li>
  );
}
