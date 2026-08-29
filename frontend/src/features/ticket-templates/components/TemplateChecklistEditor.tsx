import { useState, type KeyboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

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
            className="flex-1 rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-violet-400 dark:border-zinc-700"
          />
          <button
            type="button"
            aria-label={`Eliminar item ${index + 1}`}
            disabled={disabled}
            onClick={() => removeItem(index)}
            className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
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
          className="flex-1 rounded border border-zinc-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-violet-400 dark:border-zinc-700"
        />
        <button
          type="button"
          onClick={addDraftItem}
          disabled={disabled}
          className="flex items-center gap-1 rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar item
        </button>
      </div>
    </div>
  );
}
