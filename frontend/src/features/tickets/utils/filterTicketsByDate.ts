import { getUtcDayRange, isDueDateOverdue, parseDueDateUtc } from "@/features/tickets/utils/dueDate";
import type { TicketDateFilter } from "@/features/tickets/types/dateFilter.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

function toUtcDayTimestamp(value: string): number | null {
  const parsed = parseDueDateUtc(value);
  return parsed ? parsed.getTime() : null;
}

function isWithinRange(timestampUtc: number, fromUtc: number | null, toUtc: number | null): boolean {
  if (fromUtc !== null && timestampUtc < fromUtc) {
    return false;
  }
  if (toUtc !== null && timestampUtc > toUtc) {
    return false;
  }
  return true;
}

/**
 * Filtra tickets por su due_date de forma 100% client-side. `now` es
 * inyectable para que los tests sean deterministas.
 *
 * Devuelve el MISMO array por referencia cuando preset === "all" para evitar
 * re-renders innecesarios en los consumidores (KanbanPage/ListPage).
 */
export function filterTicketsByDate(
  tickets: readonly Ticket[],
  filter: TicketDateFilter,
  now: Date = new Date(),
): Ticket[] {
  if (filter.preset === "all") {
    return tickets as Ticket[];
  }

  if (filter.preset === "no_date") {
    return tickets.filter((ticket) => ticket.due_date === null);
  }

  if (filter.preset === "overdue") {
    return tickets.filter((ticket) => isDueDateOverdue(ticket.due_date, now));
  }

  if (filter.preset === "today" || filter.preset === "week" || filter.preset === "month") {
    const { fromUtc, toUtc } = getUtcDayRange(filter.preset, now);
    return tickets.filter((ticket) => {
      if (!ticket.due_date) {
        return false;
      }
      const dueUtc = toUtcDayTimestamp(ticket.due_date);
      if (dueUtc === null) {
        return false;
      }
      return isWithinRange(dueUtc, fromUtc, toUtc);
    });
  }

  // preset === "custom"
  const fromUtc = filter.from ? toUtcDayTimestamp(filter.from) : null;
  const toUtc = filter.to ? toUtcDayTimestamp(filter.to) : null;

  if (fromUtc === null && toUtc === null) {
    return tickets as Ticket[];
  }

  return tickets.filter((ticket) => {
    if (!ticket.due_date) {
      return false;
    }
    const dueUtc = toUtcDayTimestamp(ticket.due_date);
    if (dueUtc === null) {
      return false;
    }
    return isWithinRange(dueUtc, fromUtc, toUtc);
  });
}
