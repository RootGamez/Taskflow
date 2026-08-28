import { DEFAULT_TICKET_DESCRIPTION } from "@/features/tickets/lib/defaultTicketTemplate";
import type { TicketTemplate } from "@/features/ticket-templates/types/ticketTemplate.types";

/**
 * D24 de docs/PHASE_4_PLAN.md: la opcion "Plantilla por defecto" del picker
 * sale de `DEFAULT_TICKET_DESCRIPTION`, NO de la base de datos, y no se
 * puede borrar. Asi el comportamiento de hoy (el modal siempre precarga
 * esta descripcion) es identico para cualquier proyecto sin plantillas
 * propias, y las plantillas de usuario son estrictamente aditivas.
 *
 * Id estable con un prefijo reconocible (no un UUID) para que
 * `TicketTemplatePicker` pueda distinguirla de las plantillas reales del
 * proyecto sin una llamada de red -- por ejemplo, para no ofrecer
 * "Editar"/"Borrar" sobre ella.
 */
export const BUILT_IN_TEMPLATE_ID = "built-in-default";

export const BUILT_IN_TEMPLATE: TicketTemplate = {
  id: BUILT_IN_TEMPLATE_ID,
  project_id: "",
  name: "Plantilla por defecto",
  title_template: "",
  description: JSON.stringify(DEFAULT_TICKET_DESCRIPTION),
  priority: "none",
  items: [],
  created_at: "",
  updated_at: "",
};
