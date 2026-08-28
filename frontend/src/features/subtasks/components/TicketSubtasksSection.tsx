export interface TicketSubtasksSectionProps {
  ticketId: string;
  projectId: string;
  canEdit: boolean;
}

/**
 * Seccion de subtareas/checklist del detalle del ticket (WP-B, Fase 3).
 *
 * Stub de WP-0 (D4 de docs/PHASE_3_PLAN.md): la firma de props ya es la
 * final (D5 -- autosuficiente, sin callbacks, mismo patron que
 * `TicketLabelsRow`/`TicketDiscussion`) para que `TicketDetail.tsx` quede
 * wireado desde el primer commit. WP-B reemplaza el cuerpo entero de este
 * archivo sin volver a tocar `TicketDetail.tsx`.
 */
export function TicketSubtasksSection(_props: TicketSubtasksSectionProps) {
  return null;
}
