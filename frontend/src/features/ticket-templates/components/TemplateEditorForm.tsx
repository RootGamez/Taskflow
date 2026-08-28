import { useEffect, useState } from "react";

import { TemplateChecklistEditor } from "@/features/ticket-templates/components/TemplateChecklistEditor";
import type {
  TicketTemplate,
  TicketTemplateWritePayload,
} from "@/features/ticket-templates/types/ticketTemplate.types";
import type { Priority } from "@/features/tickets/types/ticket.types";

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: "none", label: "Sin prioridad" },
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

interface TemplateEditorFormProps {
  /** `null`/ausente = creando una plantilla nueva; presente = editandola. */
  initialTemplate?: TicketTemplate | null;
  onSubmit: (payload: TicketTemplateWritePayload) => void;
  isSubmitting?: boolean;
  /** RT-6: mensaje de error a mostrar (p.ej. "nombre duplicado"). */
  errorMessage?: string | null;
}

/**
 * Formulario de creacion/edicion de una plantilla -- panel derecho de
 * `TemplateManagerDialog` (D28 de docs/PHASE_4_PLAN.md). Sin logica de red
 * propia: el caller decide si `onSubmit` dispara un POST o un PATCH.
 */
export function TemplateEditorForm({
  initialTemplate,
  onSubmit,
  isSubmitting = false,
  errorMessage = null,
}: TemplateEditorFormProps) {
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [titleTemplate, setTitleTemplate] = useState(initialTemplate?.title_template ?? "");
  const [priority, setPriority] = useState<Priority>(initialTemplate?.priority ?? "none");
  const [items, setItems] = useState<string[]>(initialTemplate?.items.map((item) => item.title) ?? []);

  // Resetea el formulario cuando el caller cambia de plantilla seleccionada
  // (fila distinta en `TemplateManagerDialog`) o pasa a "crear nueva".
  useEffect(() => {
    setName(initialTemplate?.name ?? "");
    setTitleTemplate(initialTemplate?.title_template ?? "");
    setPriority(initialTemplate?.priority ?? "none");
    setItems(initialTemplate?.items.map((item) => item.title) ?? []);
  }, [initialTemplate]);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = () => {
    // Sin guarda redundante aca: el boton ya queda `disabled` cuando
    // `!canSubmit` (linea de abajo), asi que este handler solo se puede
    // disparar con un formulario valido.
    onSubmit({
      name: name.trim(),
      title_template: titleTemplate,
      priority,
      items,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="template-name" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Nombre
        </label>
        <input
          id="template-name"
          type="text"
          value={name}
          disabled={isSubmitting}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Bug report"
          className="rounded border border-zinc-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-zinc-700"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="template-title-prefix" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Prefijo del titulo
        </label>
        <input
          id="template-title-prefix"
          type="text"
          value={titleTemplate}
          disabled={isSubmitting}
          onChange={(event) => setTitleTemplate(event.target.value)}
          placeholder="Ej. [BUG] "
          className="rounded border border-zinc-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-zinc-700"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="template-priority" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Prioridad
        </label>
        <select
          id="template-priority"
          value={priority}
          disabled={isSubmitting}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className="rounded border border-zinc-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-zinc-700"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Checklist</span>
        <TemplateChecklistEditor items={items} onChange={setItems} disabled={isSubmitting} />
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="self-end rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Guardando..." : initialTemplate ? "Guardar cambios" : "Crear plantilla"}
      </button>
    </div>
  );
}
