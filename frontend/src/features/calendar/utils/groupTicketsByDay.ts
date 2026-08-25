import { parseDueDateUtc } from "@/features/tickets/utils/dueDate";
import type { Ticket } from "@/features/tickets/types/ticket.types";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Clave de día en formato `YYYY-MM-DD` (UTC) para un `Date`. Fuente única
 * usada tanto para agrupar tickets por día como para identificar celdas de
 * drop en el calendario (`resolveCalendarDrop.ts`), así ambos lados siempre
 * coinciden en "a qué día pertenece esta fecha".
 */
export function formatCalendarDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/**
 * Agrupa tickets por día (clave `YYYY-MM-DD` en UTC) según su `due_date`.
 * Reusa `parseDueDateUtc` (la misma utilidad que ya usa el filtro de fecha
 * del Kanban/Lista) para que "qué día es este ticket" se calcule igual en
 * todos lados — si difiriera, un ticket podría verse en el calendario y no
 * en el filtro "Hoy", o viceversa.
 *
 * Tickets sin `due_date` (null) o con un `due_date` malformado se omiten sin
 * lanzar.
 */
export function groupTicketsByDay(tickets: readonly Ticket[]): Map<string, Ticket[]> {
  const ticketsByDay = new Map<string, Ticket[]>();

  for (const ticket of tickets) {
    if (!ticket.due_date) {
      continue;
    }

    const dueDateUtc = parseDueDateUtc(ticket.due_date);
    if (!dueDateUtc) {
      continue;
    }

    const dayKey = formatCalendarDayKey(dueDateUtc);
    const existing = ticketsByDay.get(dayKey);
    if (existing) {
      existing.push(ticket);
    } else {
      ticketsByDay.set(dayKey, [ticket]);
    }
  }

  return ticketsByDay;
}
