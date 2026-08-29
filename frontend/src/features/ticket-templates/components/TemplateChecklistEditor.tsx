import { useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";

interface TemplateChecklistEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  disabled?: boolean;
}

/**
 * Editor en bloque del checklist de una plantilla (D21/D28 de
 * docs/PHASE_4_PLAN.md): `items` es la lista completa de strings que el
 * formulario padre (`TemplateEditorForm`) manda tal cual en el POST/PATCH
 * -- el servidor reemplaza el set completo (delete + bulk_create), nunca
 * hay CRUD por item.
 */
export function TemplateChecklistEditor({ items, onChange, disabled = false }: TemplateChecklistEditorProps) {
  const [draft, setDraft] = useState("");

  const updateItem = (index: number, value: string) => {
    const next = [...items];
    next[index] = value;
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addDraftItem = () => {
    // RT-7: primera linea de defensa en la UI -- strings vacios o solo
    // espacios se descartan, el resto se guarda ya recortado. El servidor
    // aplica la misma regla como defensa real
    // (`TicketTemplateCreateSerializer.validate_items`).
    const trimmed = draft.trim();
    setDraft("");
    if (!trimmed) return;
    onChange([...items, trimmed]);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraftItem();
    } else if (event.key === "Backspace" && draft === "" && items.length > 0) {
      // D28: Backspace en el composer vacio borra el ultimo item existente.
      removeItem(items.length - 1);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="text"
            value={item}
            disabled={disabled}
            onChange={(event) => updateItem(index, event.target.value)}
            aria-label={`Item ${index + 1}`}
            className="flex-1 rounded border-2 border-border bg-card px-2 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-50"
          />
          <button
            type="button"
            aria-label={`Eliminar item ${index + 1}`}
            disabled={disabled}
            onClick={() => removeItem(index)}
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleDraftKeyDown}
          placeholder="Agregar item del checklist..."
          aria-label="Agregar item del checklist"
          className="flex-1 rounded border-2 border-border bg-card px-2 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-50"
        />
        <Button type="button" size="sm" onClick={addDraftItem} disabled={disabled}>
          <Plus className="h-3.5 w-3.5" />
          Agregar item
        </Button>
      </div>
    </div>
  );
}
