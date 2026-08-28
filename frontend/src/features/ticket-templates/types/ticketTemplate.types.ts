import type { Priority } from "@/features/tickets/types/ticket.types";

/**
 * Item de checklist de una plantilla (D21 de docs/PHASE_4_PLAN.md: se edita
 * como una lista de strings desde la API, pero el servidor lo persiste como
 * fila con `order`).
 */
export interface TicketTemplateItem {
  id: string;
  title: string;
  order: number;
}

/**
 * Forma completa que devuelve la API (`TicketTemplateSerializer` en
 * `apps/tickettemplates/serializers.py`). Extiende `AppliedTicketTemplate`
 * (definida en `TicketTemplatePicker.tsx`, el stub de WP-0A) con `items`,
 * `project_id` y los timestamps -- D48 del repo: no redefinir la forma
 * minima, extenderla.
 */
export interface TicketTemplate {
  id: string;
  project_id: string;
  name: string;
  title_template: string;
  description: string;
  priority: Priority;
  items: TicketTemplateItem[];
  created_at: string;
  updated_at: string;
}

/** POST/PATCH `{ name, title_template?, description?, priority?, items?: string[] }` (D21). */
export interface TicketTemplateWritePayload {
  name: string;
  title_template?: string;
  description?: string;
  priority?: Priority;
  items?: string[];
}

export type TicketTemplateUpdatePayload = Partial<TicketTemplateWritePayload>;
