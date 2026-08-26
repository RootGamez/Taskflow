import { useState } from "react";
import { X } from "lucide-react";

import { CreateLabelInline } from "@/features/labels/components/CreateLabelInline";
import { LabelChip } from "@/features/labels/components/LabelChip";
import type { Label } from "@/features/tickets/types/ticket.types";

interface LabelPickerProps {
  labels: Label[];
  selectedLabelIds: string[];
  onChange: (labelIds: string[]) => void;
  canEdit: boolean;
  onCreateLabel?: (payload: { name: string; color: string }) => void;
  onDeleteLabel?: (labelId: string) => void;
  isCreatingLabel?: boolean;
}

/**
 * Contenido presentacional del popover de labels (multi-select tipo
 * checkbox + "+ Crear label" al final, DESIGN_SYSTEM.md 8.4). No fetchea
 * datos ni conoce React Query — el estado (labels, seleccion, mutaciones)
 * lo maneja el caller (`TicketLabelsRow`), que es quien es "autosuficiente"
 * segun D43 del plan.
 */
export function LabelPicker({
  labels,
  selectedLabelIds,
  onChange,
  canEdit,
  onCreateLabel,
  onDeleteLabel,
  isCreatingLabel = false,
}: LabelPickerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const selected = new Set(selectedLabelIds);

  const toggleLabel = (labelId: string) => {
    if (!canEdit) return;
    const next = new Set(selected);
    if (next.has(labelId)) {
      next.delete(labelId);
    } else {
      next.add(labelId);
    }
    onChange(Array.from(next));
  };

  const requestDelete = (labelId: string) => {
    setPendingDeleteId(labelId);
  };

  const confirmDelete = (labelId: string) => {
    onDeleteLabel?.(labelId);
    setPendingDeleteId(null);
  };

  return (
    <div className="flex w-60 flex-col gap-1 p-2">
      {labels.length === 0 && !isCreating ? (
        <p className="px-1 py-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Este proyecto no tiene labels todavia.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {labels.map((label) => (
            <li
              key={label.id}
              className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {pendingDeleteId === label.id ? (
                <div className="flex flex-1 items-center justify-between gap-2 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400">¿Eliminar "{label.name}"?</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => confirmDelete(label.id)}
                      className="font-medium text-red-500 hover:text-red-600"
                    >
                      Si
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="flex flex-1 items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={selected.has(label.id)}
                      disabled={!canEdit}
                      onChange={() => toggleLabel(label.id)}
                    />
                    <LabelChip label={label} />
                  </label>
                  {canEdit && onDeleteLabel ? (
                    <button
                      type="button"
                      aria-label={`Eliminar label ${label.name}`}
                      onClick={() => requestDelete(label.id)}
                      className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        isCreating ? (
          <CreateLabelInline
            isSubmitting={isCreatingLabel}
            onSubmit={(payload) => {
              onCreateLabel?.(payload);
              setIsCreating(false);
            }}
            onCancel={() => setIsCreating(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="mt-1 rounded px-1 py-1 text-left text-xs font-medium text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
          >
            + Crear label
          </button>
        )
      ) : null}
    </div>
  );
}
