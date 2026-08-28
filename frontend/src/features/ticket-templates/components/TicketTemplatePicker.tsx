import type { Priority } from "@/features/tickets/types/ticket.types";

/**
 * Forma minima que `CreateTicketModal` necesita para prefijar titulo,
 * descripcion y prioridad al aplicar una plantilla (D20 de
 * docs/PHASE_4_PLAN.md: solo el checklist se aplica en el servidor, este
 * objeto cubre la mitad que se aplica en el cliente). WP-T (Ola 1) es
 * dueño de `features/ticket-templates/types/ticketTemplate.types.ts`; ese
 * tipo mas completo (con `items`, `project_id`, timestamps, etc.) puede
 * extender esta forma sin romper el contrato con el modal.
 */
export interface AppliedTicketTemplate {
  id: string;
  title_template: string;
  /** JSON de Tiptap serializado como string, igual que `Ticket.description`. */
  description: string;
  priority: Priority;
}

interface TicketTemplatePickerProps {
  projectId: string;
  onApply: (template: AppliedTicketTemplate) => void;
  disabled?: boolean;
}

/**
 * Stub de WP-0A (docs/PHASE_4_PLAN.md seccion 3, D3): componente real con
 * la firma final, devuelve `null`. `CreateTicketModal.tsx` ya queda
 * wireado contra esta firma (import + `onApply` + montaje en el aside de
 * metadata) -- WP-T (Ola 1) reemplaza unicamente el cuerpo de este
 * archivo por el Popover real (built-in + plantillas del proyecto +
 * "Administrar plantillas", D28), sin volver a tocar el modal.
 */
export function TicketTemplatePicker(_props: TicketTemplatePickerProps) {
  return null;
}
