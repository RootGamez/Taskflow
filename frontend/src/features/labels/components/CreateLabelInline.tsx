import { useState } from "react";

import { LABEL_COLORS } from "@/features/labels/lib/labelPalette";

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
    <div className="mt-1 flex flex-col gap-2 rounded-md border border-zinc-100 p-2 dark:border-zinc-800">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Nombre del label"
        aria-label="Nombre del label"
        disabled={isSubmitting}
        className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-violet-400 dark:border-zinc-700"
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
            className={`h-5 w-5 rounded-full border-2 transition-colors ${
              color === paletteColor ? "border-zinc-900 dark:border-white" : "border-transparent"
            }`}
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
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Creando..." : "Crear"}
        </button>
      </div>
    </div>
  );
}
