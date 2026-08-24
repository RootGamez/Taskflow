import type { Ticket } from "@/features/tickets/types/ticket.types";

interface ResolveDropOrderParams {
  /** id del ticket sobre el que se soltó el drag, si se soltó sobre un ticket (no una celda vacía). */
  overTicketId: string | null | undefined;
  toColumnId: string;
  /**
   * Tickets agrupados por columna, derivados de la lista SIN filtrar
   * (allTickets). Solo se usa para el caso de "columna vacía", donde el
   * nuevo order es length + 1.
   */
  ticketsByColumn: Map<string, Ticket[]>;
  /**
   * Mapa id -> ticket, derivado de la lista SIN filtrar (allTickets). Se usa
   * para leer el `order` real del ticket destino en vez de su índice visible,
   * que puede no coincidir cuando hay un filtro de fecha activo.
   */
  ticketById: Map<string, Ticket>;
}

/**
 * Calcula el `order` destino de un ticket arrastrado en el Kanban.
 *
 * Es intencionalmente independiente de si la lista visible está filtrada:
 * siempre resuelve el order real del ticket destino (o el largo real de la
 * columna) a partir de mapas derivados de `allTickets`, nunca de la lista
 * filtrada que se renderiza.
 */
export function resolveDropOrder({
  overTicketId,
  toColumnId,
  ticketsByColumn,
  ticketById,
}: ResolveDropOrderParams): number {
  if (overTicketId) {
    const overTicket = ticketById.get(overTicketId);
    if (overTicket) {
      return overTicket.order;
    }
  }

  const destinationTickets = ticketsByColumn.get(toColumnId) ?? [];
  return destinationTickets.length + 1;
}
