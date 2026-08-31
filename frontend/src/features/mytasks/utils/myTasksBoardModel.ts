import type { BoardLane } from "@/features/board/components/LaneBoard";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import type { MergedStatusColumn } from "@/features/mytasks/utils/mergeWorkspaceStatuses";
import type { SprintScope } from "@/features/sprints/types/sprint.types";
import { groupTicketsByLaneAndStatus } from "@/features/tickets/utils/collaboratorLanes";
import type { Ticket } from "@/features/tickets/types/ticket.types";

/** Fila de "Mis tareas": un proyecto (con el espacio al que pertenece). */
export interface ProjectLane extends BoardLane {
  color: string;
  workspaceSlug: string;
}

export interface MyTasksBoardModel {
  lanes: ProjectLane[];
  ticketsByLaneAndColumn: Map<string, Map<string, Ticket[]>>;
  countByColumn: Map<string, number>;
  /** Tareas cuyo estado no cae en ninguna columna (columna sin estado mapeado). */
  unmappedCount: number;
}

/**
 * Filas del tablero: un proyecto por cada proyecto presente en las tareas,
 * ordenados por nombre. Se derivan de la lista SIN filtrar por sprint para que
 * un proyecto no desaparezca de la vista al cambiar de sprint... salvo que el
 * llamador pase ya la lista filtrada, que es lo que hace la página (un
 * proyecto sin tareas en el sprint elegido no aporta nada).
 */
export function buildProjectLanes(tasks: readonly MyTask[]): ProjectLane[] {
  const byProjectId = new Map<string, ProjectLane>();

  for (const task of tasks) {
    if (byProjectId.has(task.project.id)) continue;
    byProjectId.set(task.project.id, {
      id: task.project.id,
      name: task.project.name,
      color: task.project.color,
      workspaceSlug: task.project.workspace_slug,
    });
  }

  return [...byProjectId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Filtra por scope de sprint. A diferencia de `filterTicketsBySprint` (que es
 * de un solo espacio), acá "sprint actual" se resuelve contra el sprint activo
 * del espacio de CADA tarea: la vista es cross-espacio y cada espacio tiene el
 * suyo.
 */
export function filterTasksBySprint(
  tasks: readonly MyTask[],
  scope: SprintScope,
  activeSprintIdByWorkspaceSlug: ReadonlyMap<string, string>,
): MyTask[] {
  if (scope.kind === "all") return tasks as MyTask[];

  if (scope.kind === "backlog") {
    return tasks.filter((task) => (task.sprint_ids?.length ?? 0) === 0);
  }

  if (scope.kind === "sprint") {
    return tasks.filter((task) => task.sprint_ids?.includes(scope.sprintId));
  }

  return tasks.filter((task) => {
    const activeSprintId = activeSprintIdByWorkspaceSlug.get(task.project.workspace_slug);
    return activeSprintId ? Boolean(task.sprint_ids?.includes(activeSprintId)) : false;
  });
}

/**
 * Arma el modelo del tablero de "Mis tareas": filas = proyectos, columnas =
 * estados fusionados por nombre entre espacios.
 */
export function buildMyTasksBoardModel(
  tasks: readonly MyTask[],
  columns: readonly MergedStatusColumn[],
  columnIdByStatusId: ReadonlyMap<string, string>,
): MyTasksBoardModel {
  const lanes = buildProjectLanes(tasks);
  const columnIds = new Set(columns.map((column) => column.id));

  const getColumnId = (ticket: Ticket): string | null => {
    const statusId = ticket.workspace_status_id;
    if (!statusId) return null;
    const columnId = columnIdByStatusId.get(statusId);
    return columnId && columnIds.has(columnId) ? columnId : null;
  };

  const ticketsByLaneAndColumn = groupTicketsByLaneAndStatus({
    tickets: [...tasks],
    laneIds: lanes.map((lane) => lane.id),
    statusIds: columns.map((column) => column.id),
    getStatusId: getColumnId,
    getLaneIds: (ticket) => [(ticket as MyTask).project.id],
  });

  const countByColumn = new Map<string, number>();
  let unmappedCount = 0;

  for (const task of tasks) {
    const columnId = getColumnId(task);
    if (!columnId) {
      unmappedCount += 1;
      continue;
    }
    countByColumn.set(columnId, (countByColumn.get(columnId) ?? 0) + 1);
  }

  return { lanes, ticketsByLaneAndColumn, countByColumn, unmappedCount };
}
