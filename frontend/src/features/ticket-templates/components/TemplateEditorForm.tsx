import { useEffect, useState } from "react";

import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
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
        <label htmlFor="template-name" className="text-xs font-medium text-muted-foreground">
          Nombre
        </label>
        <Input
          id="template-name"
          type="text"
          value={name}
          disabled={isSubmitting}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ej. Bug report"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="template-title-prefix" className="text-xs font-medium text-muted-foreground">
          Prefijo del titulo
        </label>
        <Input
          id="template-title-prefix"
          type="text"
          value={titleTemplate}
          disabled={isSubmitting}
          onChange={(event) => setTitleTemplate(event.target.value)}
          placeholder="Ej. [BUG] "
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="template-priority" className="text-xs font-medium text-muted-foreground">
          Prioridad
        </label>
        <select
          id="template-priority"
          value={priority}
          disabled={isSubmitting}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className="h-10 rounded border-2 border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary disabled:opacity-50"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Checklist</span>
        <TemplateChecklistEditor items={items} onChange={setItems} disabled={isSubmitting} />
      </div>

      {errorMessage ? (
        <p className="rounded border-2 border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <Button type="button" className="self-end" onClick={handleSubmit} disabled={!canSubmit}>
        {isSubmitting ? "Guardando..." : initialTemplate ? "Guardar cambios" : "Crear plantilla"}
      </Button>
    </div>
  );
}
