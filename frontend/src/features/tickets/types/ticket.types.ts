import type { User } from "@/features/auth/types/auth.types";

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface Ticket {
  id: string;
  project_id: string;
  column_id: string;
  // Opcionales (no solo `| null`) a proposito: varios fixtures de tests
  // preexistentes (Fase 1, ej. `filterTicketsByDate.test.ts`,
  // `resolveDropOrder.test.ts`, y los de `src/features/calendar/**` del
  // agente en paralelo) construyen un `Ticket` con un helper `buildTicket`
  // que no setea estos 3 campos nuevos. El backend siempre los manda
  // (nunca vienen `undefined` en runtime real), pero declararlos como
  // requeridos hubiese roto la compilacion de esos fixtures -- incluidos
  // los de `src/features/calendar/**`, que esta fase tiene prohibido
  // tocar porque otro agente esta trabajando ahi en paralelo.
  sprint_id?: string | null;
  created_by: string | null;
  title: string;
  description: string;
  progress_notes: string;
  priority: Priority;
  order: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignees: User[];
  labels: Label[];
  number?: number | null;
  reference?: string | null;
}
