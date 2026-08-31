import { useMemo } from "react";

import { LaneBoard } from "@/features/board/components/LaneBoard";
import { LaneBoardMobile } from "@/features/board/components/LaneBoardMobile";
import { UnmappedTicketsNotice } from "@/features/board/components/UnmappedTicketsNotice";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import type { MergedStatusColumn } from "@/features/mytasks/utils/mergeWorkspaceStatuses";
import {
  buildMyTasksBoardModel,
  type ProjectLane,
} from "@/features/mytasks/utils/myTasksBoardModel";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface MyTasksBoardProps {
  tasks: MyTask[];
  columns: MergedStatusColumn[];
  columnIdByStatusId: Map<string, string>;
  /** Mover depende del rol en el espacio de cada tarea (la vista cruza espacios). */
  canMoveTask: (task: MyTask) => boolean;
  isMobile: boolean;
  onOpenTask: (task: MyTask) => void;
  onMoveTask: (task: MyTask, column: MergedStatusColumn) => void;
}

/** Encabezado de fila: el proyecto, con el espacio al que pertenece. */
function ProjectLaneHeader({
  lane,
  total,
  compact,
}: {
  lane: ProjectLane;
  total: number;
  compact: boolean;
}) {
  const Heading = compact ? "h3" : "h4";

  return (
    <div className={compact ? "flex items-center gap-2" : undefined}>
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="boxed-icon h-3.5 w-3.5 shrink-0"
          style={{ backgroundColor: lane.color }}
          aria-hidden
        />
        <Heading className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {lane.name}
        </Heading>
        {compact ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {total}
          </span>
        ) : null}
      </div>
      {compact ? null : (
        <p className="mt-1 truncate font-mono text-xs tabular-nums text-muted-foreground">
          {lane.workspaceSlug} · {total} tareas
        </p>
      )}
    </div>
  );
}

/**
 * "Mis tareas" con la misma forma que el tablero de sprint, pero con las filas
 * por proyecto en vez de por colaborador: acá todas las tareas son de una sola
 * persona, así que agrupar por responsable no diría nada.
 */
export function MyTasksBoard({
  tasks,
  columns,
  columnIdByStatusId,
  canMoveTask,
  isMobile,
  onOpenTask,
  onMoveTask,
}: MyTasksBoardProps) {
  const model = useMemo(
    () => buildMyTasksBoardModel(tasks, columns, columnIdByStatusId),
    [columnIdByStatusId, columns, tasks],
  );

  const columnById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  );

  const handleMove = (ticket: Ticket, columnId: string) => {
    const column = columnById.get(columnId);
    if (column) onMoveTask(ticket as MyTask, column);
  };

  const footer = <UnmappedTicketsNotice count={model.unmappedCount} className="mt-2" />;

  if (isMobile) {
    return (
      <LaneBoardMobile
        columns={columns}
        lanes={model.lanes}
        ticketsByLaneAndColumn={model.ticketsByLaneAndColumn}
        countByColumn={model.countByColumn}
        renderLaneHeader={(lane, total) => (
          <ProjectLaneHeader lane={lane} total={total} compact />
        )}
        canMoveTicket={(ticket) => canMoveTask(ticket as MyTask)}
        columnNoun="estado"
        noColumnsMessage="Todavía no hay estados configurados en tus espacios."
        onOpenTicket={(ticket) => onOpenTask(ticket as MyTask)}
        onMoveTicket={handleMove}
        footer={footer}
      />
    );
  }

  return (
    <LaneBoard
      columns={columns}
      lanes={model.lanes}
      ticketsByLaneAndColumn={model.ticketsByLaneAndColumn}
      countByColumn={model.countByColumn}
      laneColumnLabel="Proyectos"
      renderLaneHeader={(lane, total) => (
        <ProjectLaneHeader lane={lane} total={total} compact={false} />
      )}
      canDragTicket={(ticket) => canMoveTask(ticket as MyTask)}
      emptyMessage="No tienes tareas en este sprint."
      onOpenTicket={(ticket) => onOpenTask(ticket as MyTask)}
      onDropTicket={handleMove}
      footer={footer}
    />
  );
}
