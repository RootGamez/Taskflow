import { useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";

interface SubtaskComposerProps {
  onSubmit: (title: string) => void;
  isSubmitting?: boolean;
}

/**
 * Input de creacion rapida de subtareas. Mismo patron de "trim + limpiar tras
 * exito" que `CreateLabelInline`.
 */
export function SubtaskComposer({ onSubmit, isSubmitting = false }: SubtaskComposerProps) {
  const [title, setTitle] = useState("");

  const canSubmit = title.trim().length > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(title.trim());
    setTitle("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Agregar subtarea..."
        aria-label="Agregar subtarea"
        disabled={isSubmitting}
        className="flex-1 rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-violet-400 dark:border-zinc-700"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="flex items-center gap-1 rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar
      </button>
    </div>
  );
}
