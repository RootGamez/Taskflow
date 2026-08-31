import type { BoardColumn } from "@/features/board/components/LaneBoard";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import {
  buildCollaboratorLanes,
  groupTicketsByLaneAndStatus,
  type CollaboratorLane,
} from "@/features/tickets/utils/collaboratorLanes";
import type { Ticket } from "@/features/tickets/types/ticket.types";

export interface SprintBoardModel {
  columns: BoardColumn[];
  lanes: CollaboratorLane[];
  ticketsByLaneAndColumn: Map<string, Map<string, Ticket[]>>;
  countByColumn: Map<string, number>;
  /**
   * Tickets cuya columna de proyecto no mapea a ningún estado del espacio: no
   * caben en ninguna celda, así que se avisan aparte en vez de perderse.
   */
  unmappedCount: number;
}

/**
 * Traduce estados del espacio + tickets al modelo que consume el tablero
 * genérico: columnas = estados (por `order`), filas = colaboradores.
 *
 * Pura a propósito — las dos vistas (escritorio y móvil) comparten esta
 * derivación en vez de repetir cinco `useMemo` cada una.
 */
export function buildSprintBoardModel(
  statuses: WorkspaceStatus[],
  tickets: Ticket[],
): SprintBoardModel {
  const orderedStatuses = [...statuses].sort((a, b) => a.order - b.order);
  const columns: BoardColumn[] = orderedStatuses.map((status) => ({
    id: status.id,
    name: status.name,
    color: status.color,
  }));

  const lanes = buildCollaboratorLanes(tickets);

  const ticketsByLaneAndColumn = groupTicketsByLaneAndStatus({
    tickets,
    laneIds: lanes.map((lane) => lane.id),
    statusIds: columns.map((column) => column.id),
    getStatusId: (ticket) => ticket.workspace_status_id,
  });

  const countByColumn = new Map<string, number>();
  let unmappedCount = 0;
  const columnIds = new Set(columns.map((column) => column.id));

  for (const ticket of tickets) {
    const statusId = ticket.workspace_status_id;
    if (!statusId || !columnIds.has(statusId)) {
      unmappedCount += 1;
      continue;
    }
    countByColumn.set(statusId, (countByColumn.get(statusId) ?? 0) + 1);
  }

  return { columns, lanes, ticketsByLaneAndColumn, countByColumn, unmappedCount };
}
