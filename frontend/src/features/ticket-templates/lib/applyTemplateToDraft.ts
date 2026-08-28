import type { AppliedTicketTemplate } from "@/features/ticket-templates/components/TicketTemplatePicker";
import type { Priority } from "@/features/tickets/types/ticket.types";

export interface TicketDraftFields {
  title: string;
  description: Record<string, unknown>;
  priority: Priority;
}

const EMPTY_DOC: Record<string, unknown> = { type: "doc", content: [{ type: "paragraph" }] };

function parseTemplateDescription(raw: string): Record<string, unknown> {
  if (!raw) return EMPTY_DOC;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // RT-9: descripcion de plantilla con JSON invalido -- nunca lanza, cae
    // a un documento vacio en vez de romper al llamador.
    return EMPTY_DOC;
  }
}

/**
 * Mitad "cliente" de D20 (docs/PHASE_4_PLAN.md): titulo, descripcion y
 * prioridad se prefijan en el borrador ANTES de crear el ticket, para que
 * el usuario los vea y los edite (el servidor solo aplica el checklist,
 * `apps.tickettemplates.services.apply_template_items`). Pura e inmutable
 * (regla de la casa): nunca muta `draft`, siempre devuelve un objeto nuevo.
 *
 * `title_template` se aplica como PREFIJO del titulo actual (no como
 * reemplazo) -- consistente con el ejemplo de la API
 * (`"title_template": "[BUG] "`, con el espacio final a proposito).
 */
export function applyTemplateToDraft(draft: TicketDraftFields, template: AppliedTicketTemplate): TicketDraftFields {
  return {
    title: template.title_template ? `${template.title_template}${draft.title}` : draft.title,
    description: parseTemplateDescription(template.description),
    priority: template.priority,
  };
}
