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
    <li className="flex items-center gap-2 rounded px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800">
      <input
        type="checkbox"
        checked={subtask.is_done}
        disabled={!canEdit}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={`Marcar "${subtask.title}" como ${subtask.is_done ? "pendiente" : "hecha"}`}
      />
      <span
        className={`flex-1 text-sm ${
          subtask.is_done
            ? "text-zinc-400 line-through dark:text-zinc-500"
            : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {subtask.title}
      </span>
      {canEdit ? (
        <button
          type="button"
          aria-label="Eliminar subtarea"
          onClick={onDelete}
          className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </li>
  );
}
