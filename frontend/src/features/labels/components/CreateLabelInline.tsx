import { useState } from "react";

import { Button } from "@/components/ui/shadcn/button";
import { LABEL_COLORS } from "@/features/labels/lib/labelPalette";
import { cn } from "@/lib/utils";

interface CreateLabelInlineProps {
  onSubmit: (payload: { name: string; color: string }) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

/**
 * Input de nombre + swatches de la paleta curada (DESIGN_SYSTEM.md 8.4):
 * nunca un color picker de rueda libre, siempre uno de los 10 colores
 * predefinidos.
 */
export function CreateLabelInline({ onSubmit, onCancel, isSubmitting = false }: CreateLabelInlineProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), color });
  };

  return (
    <div className="mt-1 flex flex-col gap-2 rounded border-2 border-border p-2">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nombre del label"
        aria-label="Nombre del label"
        disabled={isSubmitting}
        className="rounded border-2 border-border bg-card px-2 py-1 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-50"
      />
      <div className="flex flex-wrap gap-1.5">
        {LABEL_COLORS.map((paletteColor) => (
          <button
            key={paletteColor}
            type="button"
            aria-label={`Usar color ${paletteColor}`}
            aria-pressed={color === paletteColor}
            disabled={isSubmitting}
            onClick={() => setColor(paletteColor)}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-colors",
              color === paletteColor ? "border-foreground" : "border-transparent",
            )}
            style={{ backgroundColor: paletteColor }}
          />
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancelar
          </button>
        ) : null}
        <Button type="button" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? "Creando..." : "Crear"}
        </Button>
      </div>
    </div>
  );
}
