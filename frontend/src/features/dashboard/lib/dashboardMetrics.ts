import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { isDueDateOverdue } from "@/features/tickets/utils/dueDate";

/**
 * Métricas puras del dashboard (docs/BRUTALIST_REDESIGN_PLAN.md §10).
 *
 * "Completado" para un ticket = su columna mapea a un `WorkspaceStatus` con
 * `is_done` (misma fuente de verdad que el tablero de sprint). El payload del
 * ticket no trae un booleano `is_done`, así que se cruza `workspace_status_id`
 * contra el set de estados "done" del espacio.
 */

/** Campos mínimos que estas métricas necesitan de un ticket. */
export type DashboardTicket = Pick<Ticket, "workspace_status_id" | "due_date">;

export function getDoneStatusIds(
  statuses: readonly WorkspaceStatus[] | undefined,
): Set<string> {
  return new Set((statuses ?? []).filter((status) => status.is_done).map((status) => status.id));
}

export function isTicketDone(
  ticket: Pick<Ticket, "workspace_status_id">,
  doneStatusIds: ReadonlySet<string>,
): boolean {
  const statusId = ticket.workspace_status_id;
  return typeof statusId === "string" && doneStatusIds.has(statusId);
}

export interface ProjectProgress {
  total: number;
  completed: number;
  /** Entero en [0, 100]. `total === 0` devuelve `0` (sin división por cero). */
  percent: number;
}

export function summarizeProgress(
  tickets: readonly Pick<Ticket, "workspace_status_id">[],
  doneStatusIds: ReadonlySet<string>,
): ProjectProgress {
  const total = tickets.length;
  const completed = tickets.filter((ticket) => isTicketDone(ticket, doneStatusIds)).length;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
  return { total, completed, percent };
}

export function countOpenTickets(
  tickets: readonly Pick<Ticket, "workspace_status_id">[],
  doneStatusIds: ReadonlySet<string>,
): number {
  return tickets.filter((ticket) => !isTicketDone(ticket, doneStatusIds)).length;
}

export function countOverdueTickets(
  tickets: readonly DashboardTicket[],
  doneStatusIds: ReadonlySet<string>,
  now: Date = new Date(),
): number {
  return tickets.filter(
    (ticket) => !isTicketDone(ticket, doneStatusIds) && isDueDateOverdue(ticket.due_date, now),
  ).length;
}
