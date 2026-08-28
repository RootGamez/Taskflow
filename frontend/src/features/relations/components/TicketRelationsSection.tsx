export interface TicketRelationsSectionProps {
  ticketId: string;
  projectId: string;
  canEdit: boolean;
}

/**
 * Seccion de relaciones entre tickets del detalle del ticket (WP-C, Fase 3).
 *
 * Stub de WP-0 (D4 de docs/PHASE_3_PLAN.md): la firma de props ya es la
 * final (D5 -- autosuficiente, sin callbacks, mismo patron que
 * `TicketLabelsRow`/`TicketDiscussion`) para que `TicketDetail.tsx` quede
 * wireado desde el primer commit. WP-C reemplaza el cuerpo entero de este
 * archivo sin volver a tocar `TicketDetail.tsx`.
 */
export function TicketRelationsSection(_props: TicketRelationsSectionProps) {
  return null;
}
