import { useMemo } from "react";

import { LaneBoard } from "@/features/board/components/LaneBoard";
import { UnmappedTicketsNotice } from "@/features/board/components/UnmappedTicketsNotice";
import { buildSprintBoardModel } from "@/features/board/lib/sprintBoardModel";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { CollaboratorLane } from "@/features/tickets/utils/collaboratorLanes";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface SprintBoardProps {
  statuses: WorkspaceStatus[];
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onChangeStatus: (ticket: Ticket, statusId: string) => void;
}

/** Encabezado de fila: el colaborador y cuántos tickets tiene en la vista. */
export function CollaboratorLaneHeader({
  lane,
  total,
}: {
  lane: CollaboratorLane;
  total: number;
}) {
  return (
    <>
      <div className="mb-1 flex min-w-0 items-center gap-2">
        {lane.user ? (
          <MemberAvatar user={lane.user} size="sm" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-xs font-semibold text-muted-foreground">
            SA
          </div>
        )}
        <h4 className="truncate text-sm font-semibold text-foreground">{lane.name}</h4>
      </div>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">{total} tickets</p>
    </>
  );
}

/**
 * Tablero de sprint (escritorio): estados del espacio en columnas,
 * colaboradores en filas. Cruza proyectos, así que la tarjeta muestra a qué
 * proyecto pertenece cada ticket.
 */
export function SprintBoard({
  statuses,
  tickets,
  canMutate,
  onOpenTicket,
  onChangeStatus,
}: SprintBoardProps) {
  const model = useMemo(() => buildSprintBoardModel(statuses, tickets), [statuses, tickets]);

  return (
    <LaneBoard
      columns={model.columns}
      lanes={model.lanes}
      ticketsByLaneAndColumn={model.ticketsByLaneAndColumn}
      countByColumn={model.countByColumn}
      laneColumnLabel="Colaboradores"
      renderLaneHeader={(lane, total) => <CollaboratorLaneHeader lane={lane} total={total} />}
      canDragTicket={() => canMutate}
      showProjectOnCard
      emptyMessage="No hay tickets para mostrar el tablero por colaboradores."
      onOpenTicket={onOpenTicket}
      onDropTicket={(ticket, statusId) => {
        // Soltar en la fila de otro colaborador no reasigna: del destino solo
        // cuenta la columna.
        if (ticket.workspace_status_id === statusId) return;
        onChangeStatus(ticket, statusId);
      }}
      footer={<UnmappedTicketsNotice count={model.unmappedCount} className="mt-2" />}
    />
  );
}
