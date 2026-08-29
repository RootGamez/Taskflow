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

import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface SprintBoardProps {
  statuses: WorkspaceStatus[];
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onChangeStatus: (ticket: Ticket, statusId: string) => void;
}

const NO_STATUS = "__no_status__";

function DraggableCard({
  ticket,
  canMutate,
  onOpen,
  accentColor,
}: {
  ticket: Ticket;
  canMutate: boolean;
  onOpen: (ticket: Ticket) => void;
  accentColor?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ticket.id,
    disabled: !canMutate,
    data: { ticket },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`select-none ${canMutate ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-30" : ""}`}
    >
      <TicketCard ticket={ticket} onOpen={onOpen} showProject accentColor={accentColor} />
    </div>
  );
}

function StatusColumn({
  status,
  tickets,
  canMutate,
  onOpenTicket,
}: {
  status: { id: string; name: string; color: string; is_done: boolean };
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  // Agrupar por proyecto, ordenar por nombre de proyecto y luego por `order`.
  const groups = useMemo(() => {
    const byProject = new Map<string, { name: string; color: string; tickets: Ticket[] }>();
    for (const ticket of tickets) {
      const key = ticket.project?.id ?? ticket.project_id;
      const existing = byProject.get(key);
      if (existing) {
        existing.tickets.push(ticket);
      } else {
        byProject.set(key, {
          name: ticket.project?.name ?? "Proyecto",
          color: ticket.project?.color ?? "#94a3b8",
          tickets: [ticket],
        });
      }
    }
    return [...byProject.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((group) => ({
        ...group,
        tickets: group.tickets.sort(
          (a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at),
        ),
      }));
  }, [tickets]);

  return (
    <section
      ref={setNodeRef}
      className={`flex w-[320px] shrink-0 flex-col rounded border-2 bg-card transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between border-b-2 border-border px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-3 w-3 shrink-0 border-2 border-border"
            style={{ backgroundColor: status.color }}
            aria-hidden
          />
          <h3 className="truncate font-display text-sm font-bold tracking-tight text-foreground">
            {status.name}
          </h3>
        </div>
        <span className="shrink-0 border-[1.5px] border-border bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
          {tickets.length}
        </span>
      </div>

      <div className="max-h-[calc(100dvh-16rem)] space-y-3 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="border-2 border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
            Sin tickets
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.name} className="space-y-2">
              <div className="flex items-center gap-1.5 border-b border-border px-1 pb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <span
                  className="h-2 w-2 shrink-0 border border-border"
                  style={{ backgroundColor: group.color }}
                  aria-hidden
                />
                {group.name}
              </div>
              {group.tickets.map((ticket) => (
                <DraggableCard
                  key={ticket.id}
                  ticket={ticket}
                  canMutate={canMutate}
                  onOpen={onOpenTicket}
                  accentColor={status.color}
                />
              ))}
            </div>
          ))
        )}
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
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const orderedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.order - b.order),
    [statuses],
  );

  const ticketsByStatus = useMemo(() => {
    const mapping = new Map<string, Ticket[]>();
    for (const status of orderedStatuses) mapping.set(status.id, []);
    mapping.set(NO_STATUS, []);
    for (const ticket of tickets) {
      const key = ticket.workspace_status_id ?? NO_STATUS;
      (mapping.get(key) ?? mapping.get(NO_STATUS))!.push(ticket);
    }
    return mapping;
  }, [orderedStatuses, tickets]);

  const unmapped = ticketsByStatus.get(NO_STATUS) ?? [];

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTicket((event.active.data.current?.ticket as Ticket) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTicket(null);
    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const targetStatusId = event.over ? String(event.over.id) : null;
    if (!ticket || !targetStatusId || targetStatusId === NO_STATUS) return;
    if (ticket.workspace_status_id === targetStatusId) return;
    onChangeStatus(ticket, targetStatusId);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTicket(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-3">
        {orderedStatuses.map((status) => (
          <StatusColumn
            key={status.id}
            status={status}
            tickets={ticketsByStatus.get(status.id) ?? []}
            canMutate={canMutate}
            onOpenTicket={onOpenTicket}
          />
        ))}
      </div>

      {unmapped.length > 0 ? (
        <p className="mt-2 border-2 border-mustard bg-mustard/10 px-3 py-2 text-xs text-mustard">
          {unmapped.length} ticket(s) en columnas de proyecto que no corresponden a ningún
          estado del espacio.
        </p>
      ) : null}

      <DragOverlay dropAnimation={null}>
        {activeTicket ? (
          <div className="w-[300px] rotate-1 cursor-grabbing shadow-hard-lg dark:shadow-hard-float">
            <TicketCard
              ticket={activeTicket}
              onOpen={onOpenTicket}
              showProject
              accentColor={
                orderedStatuses.find((s) => s.id === activeTicket.workspace_status_id)?.color
              }
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
