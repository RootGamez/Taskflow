import type { User } from "@/features/auth/types/auth.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

/**
 * Fila del tablero para los tickets sin responsable. Es un id sintético
 * (nunca choca con un uuid de usuario) para poder tratarla como una fila más.
 */
export const UNASSIGNED_LANE_ID = "__unassigned__";

/** Una fila del tablero: un colaborador, o la fila "Sin asignar". */
export interface CollaboratorLane {
  id: string;
  name: string;
  user: User | null;
}

/** Ordena tickets como lo hace el tablero: por `order` y, a igual order, por antigüedad. */
function byOrderThenCreatedAt(a: Ticket, b: Ticket): number {
  return a.order - b.order || a.created_at.localeCompare(b.created_at);
}

/**
 * Deriva las filas de colaborador de una lista de tickets: un colaborador por
 * cada responsable distinto, ordenados por nombre, y "Sin asignar" al final
 * solo si algún ticket lo necesita.
 *
 * Se espera recibir la lista SIN filtrar: las filas no deben desaparecer
 * porque un filtro activo oculte momentáneamente todos los tickets de esa
 * persona (para ese caso está el placeholder por celda).
 */
export function buildCollaboratorLanes(tickets: Ticket[]): CollaboratorLane[] {
  const byUserId = new Map<string, CollaboratorLane>();

  for (const ticket of tickets) {
    for (const assignee of ticket.assignees) {
      if (!byUserId.has(assignee.id)) {
        byUserId.set(assignee.id, {
          id: assignee.id,
          name: assignee.full_name,
          user: assignee,
        });
      }
    }
  }

  const lanes = [...byUserId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));

  if (tickets.some((ticket) => ticket.assignees.length === 0)) {
    lanes.push({ id: UNASSIGNED_LANE_ID, name: "Sin asignar", user: null });
  }

  return lanes;
}

/**
 * Filas en las que debe aparecer un ticket. Un ticket con varios responsables
 * se repite en la fila de cada uno (a propósito: cada persona ve su carga
 * completa).
 */
export function getTicketLaneIds(ticket: Ticket): string[] {
  if (ticket.assignees.length === 0) {
    return [UNASSIGNED_LANE_ID];
  }
  return ticket.assignees.map((assignee) => assignee.id);
}

interface GroupByLaneAndStatusParams {
  /** Tickets visibles (ya filtrados, si hay filtro activo). */
  tickets: Ticket[];
  laneIds: string[];
  /** Ids de las columnas del tablero: columnas de proyecto o estados del espacio. */
  statusIds: string[];
  /** Cómo leer del ticket la columna a la que pertenece. */
  getStatusId: (ticket: Ticket) => string | null | undefined;
}

/**
 * Cruza filas de colaborador con columnas: `Map<laneId, Map<statusId, Ticket[]>>`.
 * Todas las celdas existen aunque estén vacías, para que el render no tenga que
 * distinguir "sin entrada" de "sin tickets". Los tickets cuyo estado es `null` o
 * no está en `statusIds` se omiten — quien los necesite los cuenta aparte.
 */
export function groupTicketsByLaneAndStatus({
  tickets,
  laneIds,
  statusIds,
  getStatusId,
}: GroupByLaneAndStatusParams): Map<string, Map<string, Ticket[]>> {
  const grouped = new Map<string, Map<string, Ticket[]>>();

  for (const laneId of laneIds) {
    const cells = new Map<string, Ticket[]>();
    for (const statusId of statusIds) {
      cells.set(statusId, []);
    }
    grouped.set(laneId, cells);
  }

  for (const ticket of tickets) {
    const statusId = getStatusId(ticket);
    if (!statusId) continue;

    for (const laneId of getTicketLaneIds(ticket)) {
      grouped.get(laneId)?.get(statusId)?.push(ticket);
    }
  }

  for (const cells of grouped.values()) {
    for (const [statusId, cellTickets] of cells.entries()) {
      cells.set(statusId, [...cellTickets].sort(byOrderThenCreatedAt));
    }
  }

  return grouped;
}

/**
 * Agrupa una sola lista de tickets (ya acotada a un estado) por fila de
 * colaborador. Es la variante que usa el tablero móvil, que muestra un estado
 * a la vez en vertical en vez de la grilla completa.
 */
export function groupTicketsByLane(
  tickets: Ticket[],
  laneIds: string[],
): Map<string, Ticket[]> {
  const grouped = new Map<string, Ticket[]>(laneIds.map((laneId) => [laneId, []]));

  for (const ticket of tickets) {
    for (const laneId of getTicketLaneIds(ticket)) {
      grouped.get(laneId)?.push(ticket);
    }
  }

  for (const [laneId, laneTickets] of grouped.entries()) {
    grouped.set(laneId, [...laneTickets].sort(byOrderThenCreatedAt));
  }

  return grouped;
}
