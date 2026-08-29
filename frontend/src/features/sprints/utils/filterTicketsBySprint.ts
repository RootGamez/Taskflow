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
  // "current" se resuelve al sprint activo ANTES de llegar aca (en la
  // pagina). Si igual llega, se trata como "sin filtro".
  if (scope.kind === "all" || scope.kind === "current") {
    return tickets as Ticket[];
  }

  if (scope.kind === "backlog") {
    // Sin ningun sprint = Backlog. `sprint_ids` puede venir undefined en
    // fixtures viejos; se trata como lista vacia.
    return tickets.filter((ticket) => (ticket.sprint_ids?.length ?? 0) === 0);
  }

  // Un ticket "arrastrado" que esta en varios sprints aparece en todos ellos.
  return tickets.filter((ticket) => ticket.sprint_ids?.includes(scope.sprintId));
}
