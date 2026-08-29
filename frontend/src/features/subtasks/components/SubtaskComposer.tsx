import { useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";

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
        className="h-9 flex-1 rounded border-2 border-border bg-card px-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-50"
      />
      <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
        <Plus className="h-3.5 w-3.5" />
        Agregar
      </Button>
    </div>
  );
}
