import type { Priority } from "@/features/tickets/types/ticket.types";

/**
 * Los 5 valores que puede tomar `relation_type` en la RESPUESTA (resuelto
 * desde la perspectiva del ticket consultado, D39 de docs/PHASE_3_PLAN.md)
 * y que acepta el `POST` (D38, azucar de UX sobre los 3 valores reales).
 */
export type RelationType = "blocked_by" | "blocks" | "relates_to" | "duplicate_of" | "duplicated_by";

/**
 * Los unicos 3 valores que viven en la DB (D38). `TicketRelation.stored_type`
 * siempre es uno de estos, nunca `blocked_by`/`duplicated_by`.
 */
export type StoredRelationType = "blocks" | "relates_to" | "duplicate_of";

export type RelationDirection = "incoming" | "outgoing";

/**
 * El ticket embebido en una relacion -- siempre el OTRO extremo, nunca el
 * ticket consultado (D39). Forma lean a proposito (D48): solo lo que
 * `RelationBadge` necesita renderizar.
 */
export interface RelatedTicket {
  id: string;
  title: string;
  reference: string | null;
  priority: Priority;
  column_name: string;
}

export interface TicketRelation {
  id: string;
  relation_type: RelationType;
  stored_type: StoredRelationType;
  direction: RelationDirection;
  ticket: RelatedTicket;
  created_at: string;
}

export interface CreateRelationPayload {
  relation_type: RelationType;
  ticket_id: string;
}
