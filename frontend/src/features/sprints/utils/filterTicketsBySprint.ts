import type { SprintScope } from "@/features/sprints/types/sprint.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

/**
 * Filtra tickets segun el scope de sprint activo, 100% client-side (D4): el
 * proyecto ya trae todos los tickets en una sola query y este filtro corre
 * en memoria, igual que `filterTicketsByDate`.
 *
 * Devuelve el MISMO array por referencia cuando `scope.kind === "all"` (D20)
 * para no romper la memoizacion de `KanbanBoard` -- mismo contrato que
 * `filterTicketsByDate`.
 */
export function filterTicketsBySprint(tickets: readonly Ticket[], scope: SprintScope): Ticket[] {
  if (scope.kind === "all") {
    return tickets as Ticket[];
  }

  if (scope.kind === "backlog") {
    // `sprint_id` es `string | null | undefined` (ver ticket.types.ts):
    // tanto `null` como `undefined` cuentan como "sin sprint" (Backlog).
    return tickets.filter((ticket) => !ticket.sprint_id);
  }

  return tickets.filter((ticket) => ticket.sprint_id === scope.sprintId);
}
