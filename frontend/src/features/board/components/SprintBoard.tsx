import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { Badge } from "@/components/ui/shadcn/badge";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import {
  buildCollaboratorLanes,
  groupTicketsByLaneAndStatus,
} from "@/features/tickets/utils/collaboratorLanes";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { cn } from "@/lib/utils";

interface SprintBoardProps {
  statuses: WorkspaceStatus[];
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onChangeStatus: (ticket: Ticket, statusId: string) => void;
}

function getCellDropId(laneId: string, statusId: string) {
  return `cell::${laneId}::${statusId}`;
}

function getTicketDragId(ticketId: string, laneId: string) {
  return `ticket::${ticketId}::${laneId}`;
}

function DraggableCard({
  ticket,
  laneId,
  canMutate,
  onOpen,
  accentColor,
}: {
  ticket: Ticket;
  laneId: string;
  canMutate: boolean;
  onOpen: (ticket: Ticket) => void;
  accentColor?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // Un ticket con varios responsables se repite en varias filas: el id de
    // drag lleva la fila para que cada copia sea un draggable distinto.
    id: getTicketDragId(ticket.id, laneId),
    disabled: !canMutate,
    data: { ticket },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none select-none",
        canMutate && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <TicketCard ticket={ticket} onOpen={onOpen} showProject accentColor={accentColor} />
    </div>
  );
}

function TicketCell({
  laneId,
  status,
  tickets,
  canMutate,
  onOpenTicket,
}: {
  laneId: string;
  status: WorkspaceStatus;
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: getCellDropId(laneId, status.id),
    data: { laneId, statusId: status.id, type: "cell" },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "border-2 bg-background p-2 transition-colors",
        isOver ? "border-primary ring-2 ring-ring" : "border-border",
      )}
    >
      <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
        {tickets.map((ticket) => (
          <DraggableCard
            key={getTicketDragId(ticket.id, laneId)}
            ticket={ticket}
            laneId={laneId}
            canMutate={canMutate}
            onOpen={onOpenTicket}
            accentColor={status.color}
          />
        ))}
      </div>
    </section>
  );
}

export function SprintBoard({
  statuses,
  tickets,
  canMutate,
  onOpenTicket,
  onChangeStatus,
}: SprintBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order - b.order),
    [statuses],
  );

  const collaboratorLanes = useMemo(() => buildCollaboratorLanes(tickets), [tickets]);

  const ticketsByLaneAndStatus = useMemo(
    () =>
      groupTicketsByLaneAndStatus({
        tickets,
        laneIds: collaboratorLanes.map((lane) => lane.id),
        statusIds: orderedStatuses.map((status) => status.id),
        getStatusId: (ticket) => ticket.workspace_status_id,
      }),
    [collaboratorLanes, orderedStatuses, tickets],
  );

  const countByStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ticket of tickets) {
      const statusId = ticket.workspace_status_id;
      if (!statusId) continue;
      counts.set(statusId, (counts.get(statusId) ?? 0) + 1);
    }
    return counts;
  }, [tickets]);

  const laneTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [laneId, cells] of ticketsByLaneAndStatus.entries()) {
      let total = 0;
      for (const cellTickets of cells.values()) total += cellTickets.length;
      totals.set(laneId, total);
    }
    return totals;
  }, [ticketsByLaneAndStatus]);

  // Tickets cuya columna de proyecto no mapea a ningun estado del espacio: no
  // caben en ninguna celda, asi que se avisan aparte en vez de perderse.
  const unmappedCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          !ticket.workspace_status_id ||
          !orderedStatuses.some((status) => status.id === ticket.workspace_status_id),
      ).length,
    [orderedStatuses, tickets],
  );

  const ticketById = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.id, ticket])),
    [tickets],
  );

  const activeTicket = useMemo(() => {
    if (!activeDragId) return null;
    const [, ticketId] = activeDragId.split("::");
    return ticketById.get(ticketId ?? "") ?? null;
  }, [activeDragId, ticketById]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    if (!canMutate || !event.over) return;

    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const targetStatusId = (event.over.data.current as { statusId?: string } | undefined)?.statusId;
    if (!ticket || !targetStatusId) return;
    // Soltar en la fila de otro colaborador no reasigna (igual que el tablero
    // de proyectos): del destino solo cuenta la columna.
    if (ticket.workspace_status_id === targetStatusId) return;

    onChangeStatus(ticket, targetStatusId);
  };

  if (collaboratorLanes.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No hay tickets para mostrar el tablero por colaboradores.
      </div>
    );
  }

  const gridTemplateColumns = `240px repeat(${Math.max(orderedStatuses.length, 1)}, minmax(300px, 1fr))`;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[1280px] space-y-3">
          <div className="grid gap-3" style={{ gridTemplateColumns }}>
            <div className="flex items-end px-3 py-2">
              <span className="eyebrow">Colaboradores</span>
            </div>
            {orderedStatuses.map((status) => (
              <div key={`header-${status.id}`} className="border-2 border-border bg-card">
                {/* Color arbitrario del usuario: barra superior de 3px, nunca
                    fondo del texto (DESIGN_SYSTEM.md §3). */}
                <div
                  className="h-[3px] w-full"
                  style={{ backgroundColor: status.color }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <h3 className="truncate font-display text-sm font-bold uppercase tracking-wide text-foreground">
                    {status.name}
                  </h3>
                  <Badge variant="secondary" mono>
                    {countByStatus.get(status.id) ?? 0}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {collaboratorLanes.map((lane) => {
            const cells = ticketsByLaneAndStatus.get(lane.id);
            const total = laneTotals.get(lane.id) ?? 0;

            return (
              <div key={lane.id} className="grid gap-3" style={{ gridTemplateColumns }}>
                <aside className="border-2 border-border bg-card p-3">
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
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {total} tickets
                  </p>
                </aside>

                {orderedStatuses.map((status) => (
                  <TicketCell
                    key={`${lane.id}-${status.id}`}
                    laneId={lane.id}
                    status={status}
                    tickets={cells?.get(status.id) ?? []}
                    canMutate={canMutate}
                    onOpenTicket={onOpenTicket}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {unmappedCount > 0 ? (
        <p className="mt-2 border-2 border-mustard bg-mustard/10 px-3 py-2 text-xs text-mustard">
          {unmappedCount} ticket(s) en columnas de proyecto que no corresponden a ningún estado
          del espacio.
        </p>
      ) : null}

      <DragOverlay dropAnimation={null}>
        {activeTicket ? (
          <div className="w-[300px] rotate-1 cursor-grabbing">
            <TicketCard
              ticket={activeTicket}
              onOpen={onOpenTicket}
              showProject
              accentColor={
                orderedStatuses.find((s) => s.id === activeTicket.workspace_status_id)?.color
              }
              className="shadow-hard dark:shadow-hard-float"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
