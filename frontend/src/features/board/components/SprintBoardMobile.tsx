import { useMemo } from "react";

import { LaneBoardMobile } from "@/features/board/components/LaneBoardMobile";
import { UnmappedTicketsNotice } from "@/features/board/components/UnmappedTicketsNotice";
import { buildSprintBoardModel } from "@/features/board/lib/sprintBoardModel";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { CollaboratorLane } from "@/features/tickets/utils/collaboratorLanes";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface SprintBoardMobileProps {
  statuses: WorkspaceStatus[];
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onChangeStatus: (ticket: Ticket, statusId: string) => void;
}

/**
 * Tablero de sprint en móvil: un estado a la vez (chips arriba) y, dentro del
 * estado activo, los tickets agrupados por colaborador.
 */
export function SprintBoardMobile({
  statuses,
  tickets,
  canMutate,
  onOpenTicket,
  onChangeStatus,
}: SprintBoardMobileProps) {
  const model = useMemo(() => buildSprintBoardModel(statuses, tickets), [statuses, tickets]);

  return (
    <LaneBoardMobile
      columns={model.columns}
      lanes={model.lanes}
      ticketsByLaneAndColumn={model.ticketsByLaneAndColumn}
      countByColumn={model.countByColumn}
      renderLaneHeader={(lane: CollaboratorLane, total: number) => (
        <div className="flex items-center gap-2">
          {lane.user ? (
            <MemberAvatar user={lane.user} size="sm" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-muted text-xs font-semibold text-muted-foreground">
              SA
            </div>
          )}
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {lane.name}
          </h3>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{total}</span>
        </div>
      )}
      canMoveTicket={() => canMutate}
      showProjectOnCard
      columnNoun="estado"
      noColumnsMessage="Este espacio todavía no tiene estados configurados."
      onOpenTicket={onOpenTicket}
      onMoveTicket={onChangeStatus}
      footer={<UnmappedTicketsNotice count={model.unmappedCount} />}
    />
  );
}
