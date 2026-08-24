import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";

import type { Column } from "@/features/projects/types/project.types";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface KanbanBoardProps {
  columns: Column[];
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onCreateTicket: (columnId: string) => void;
  onMoveTicket: (payload: {
    ticketId: string;
    fromColumnId: string;
    toColumnId: string;
    toOrder: number;
  }) => void | Promise<void>;
}

type ColumnTone = "backlog" | "progress" | "done" | "default";

interface CollaboratorLane {
  id: string;
  name: string;
  user: Ticket["assignees"][number] | null;
}

const UNASSIGNED_LANE_ID = "__unassigned__";

function getColumnTone(name: string): ColumnTone {
  const normalizedName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    normalizedName.includes("backlog") ||
    normalizedName.includes("pendiente") ||
    normalizedName.includes("por hacer") ||
    normalizedName.includes("to do") ||
    normalizedName.includes("sin empezar")
  ) {
    return "backlog";
  }

  if (
    normalizedName.includes("en progreso") ||
    normalizedName.includes("progreso") ||
    normalizedName.includes("in progress") ||
    normalizedName.includes("doing") ||
    normalizedName.includes("en curso")
  ) {
    return "progress";
  }

  if (
    normalizedName.includes("hecho") ||
    normalizedName.includes("done") ||
    normalizedName.includes("completado") ||
    normalizedName.includes("finalizado") ||
    normalizedName.includes("listo")
  ) {
    return "done";
  }

  return "default";
}

function getCellDropId(laneId: string, columnId: string) {
  return `cell::${laneId}::${columnId}`;
}

function getTicketDragId(ticketId: string, laneId: string) {
  return `ticket::${ticketId}::${laneId}`;
}

function parseCellDropId(id: string): { laneId: string; columnId: string } | null {
  if (!id.startsWith("cell::")) return null;
  const [, laneId, columnId] = id.split("::");
  if (!laneId || !columnId) return null;
  return { laneId, columnId };
}

function SortableTicketCard({
  ticket,
  laneId,
  tone,
  onOpen,
}: {
  ticket: Ticket;
  laneId: string;
  tone: ColumnTone;
  onOpen: (ticket: Ticket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: getTicketDragId(ticket.id, laneId),
    data: {
      ticketId: ticket.id,
      columnId: ticket.column_id,
      laneId,
      type: "ticket",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
    willChange: "transform",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing select-none"
    >
      <TicketCard
        ticket={ticket}
        onOpen={onOpen}
        tone={tone}
        className="shadow-sm shadow-black/10"
      />
    </div>
  );
}

function TicketCell({
  laneId,
  column,
  columnTickets,
  canMutate,
  tone,
  onOpenTicket,
  onCreateTicket,
}: {
  laneId: string;
  column: Column;
  columnTickets: Ticket[];
  canMutate: boolean;
  tone: ColumnTone;
  onOpenTicket: (ticket: Ticket) => void;
  onCreateTicket: (columnId: string) => void;
}) {
  const dropId = getCellDropId(laneId, column.id);
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: {
      laneId,
      columnId: column.id,
      type: "cell",
    },
  });

  const cellToneClass: Record<ColumnTone, string> = {
    backlog: "border-zinc-200/90 bg-zinc-100/30 dark:border-zinc-800 dark:bg-zinc-900/25",
    progress: "border-blue-200/80 bg-blue-50/25 dark:border-blue-900 dark:bg-blue-950/20",
    done: "border-emerald-200/80 bg-emerald-50/25 dark:border-emerald-900 dark:bg-emerald-950/20",
    default: "border-zinc-200/80 bg-zinc-100/20 dark:border-zinc-800 dark:bg-zinc-900/20",
  };

  const overRingClass = isOver
    ? "ring-2 ring-blue-400/60 dark:ring-blue-500/50"
    : "ring-1 ring-transparent";

  return (
    <section
      ref={setNodeRef}
      className={`rounded-2xl border p-2 transition-colors ${cellToneClass[tone]} ${overRingClass}`}
    >
      <SortableContext
        id={dropId}
        items={columnTickets.map((ticket) => getTicketDragId(ticket.id, laneId))}
        strategy={verticalListSortingStrategy}
      >
        <div className="max-h-[430px] space-y-2 overflow-y-auto pr-1">
          {columnTickets.map((ticket) => (
            <SortableTicketCard
              key={getTicketDragId(ticket.id, laneId)}
              ticket={ticket}
              laneId={laneId}
              tone={tone}
              onOpen={onOpenTicket}
            />
          ))}
        </div>
      </SortableContext>

      {canMutate ? (
        <button
          type="button"
          onClick={() => onCreateTicket(column.id)}
          className="mt-2 w-full rounded-xl bg-white/70 px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-white dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          + Crear tarea
        </button>
      ) : null}
    </section>
  );
}

export function KanbanBoard({
  columns,
  tickets,
  canMutate,
  onOpenTicket,
  onCreateTicket,
  onMoveTicket,
}: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const orderedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  );

  const collaboratorLanes = useMemo(() => {
    const mapping = new Map<string, CollaboratorLane>();

    for (const ticket of tickets) {
      for (const assignee of ticket.assignees) {
        if (!mapping.has(assignee.id)) {
          mapping.set(assignee.id, {
            id: assignee.id,
            name: assignee.full_name,
            user: assignee,
          });
        }
      }
    }

    const lanes = Array.from(mapping.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );

    const hasUnassigned = tickets.some((ticket) => ticket.assignees.length === 0);
    if (hasUnassigned) {
      lanes.push({ id: UNASSIGNED_LANE_ID, name: "Sin asignar", user: null });
    }

    return lanes;
  }, [tickets]);

  const ticketsByLaneAndColumn = useMemo(() => {
    const mapping = new Map<string, Map<string, Ticket[]>>();

    for (const lane of collaboratorLanes) {
      const laneColumns = new Map<string, Ticket[]>();
      for (const column of orderedColumns) {
        laneColumns.set(column.id, []);
      }
      mapping.set(lane.id, laneColumns);
    }

    for (const ticket of tickets) {
      const targetLaneIds =
        ticket.assignees.length === 0
          ? [UNASSIGNED_LANE_ID]
          : ticket.assignees.map((assignee) => assignee.id);

      for (const laneId of targetLaneIds) {
        const laneColumns = mapping.get(laneId);
        if (!laneColumns) continue;
        laneColumns.get(ticket.column_id)?.push(ticket);
      }
    }

    for (const laneColumns of mapping.values()) {
      for (const [columnId, columnTickets] of laneColumns.entries()) {
        laneColumns.set(
          columnId,
          [...columnTickets].sort(
            (a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at),
          ),
        );
      }
    }

    return mapping;
  }, [collaboratorLanes, orderedColumns, tickets]);

  const ticketsByColumn = useMemo(() => {
    const mapping = new Map<string, Ticket[]>();
    for (const column of orderedColumns) {
      mapping.set(column.id, []);
    }
    for (const ticket of tickets) {
      if (!mapping.has(ticket.column_id)) {
        mapping.set(ticket.column_id, []);
      }
      mapping.get(ticket.column_id)?.push(ticket);
    }
    for (const [columnId, columnTickets] of mapping.entries()) {
      mapping.set(
        columnId,
        [...columnTickets].sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at)),
      );
    }
    return mapping;
  }, [orderedColumns, tickets]);

  const ticketById = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.id, ticket])),
    [tickets],
  );

  const laneTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const lane of collaboratorLanes) {
      const laneColumns = ticketsByLaneAndColumn.get(lane.id);
      if (!laneColumns) {
        totals.set(lane.id, 0);
        continue;
      }
      let count = 0;
      for (const columnTickets of laneColumns.values()) {
        count += columnTickets.length;
      }
      totals.set(lane.id, count);
    }
    return totals;
  }, [collaboratorLanes, ticketsByLaneAndColumn]);

  const headerToneClass: Record<ColumnTone, string> = {
    backlog: "bg-zinc-100/70 dark:bg-zinc-900/75",
    progress: "bg-blue-50/55 dark:bg-blue-950/40",
    done: "bg-emerald-50/55 dark:bg-emerald-950/40",
    default: "bg-zinc-100/60 dark:bg-zinc-900/55",
  };

  const badgeToneClass: Record<ColumnTone, string> = {
    backlog: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/70 dark:text-blue-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300",
    default: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTicketId(null);

    if (!canMutate || !event.over) {
      return;
    }

    const activeData = event.active.data.current as
      | { ticketId?: string; columnId?: string }
      | undefined;
    const overData = event.over.data.current as
      | { ticketId?: string; columnId?: string }
      | undefined;

    const ticketId = activeData?.ticketId;
    const fromColumnId = activeData?.columnId;

    if (!ticketId || !fromColumnId) {
      return;
    }

    const overId = String(event.over.id);
    const parsedCell = parseCellDropId(overId);
    const toColumnId = overData?.columnId ?? parsedCell?.columnId;

    if (!toColumnId) {
      return;
    }

    let toOrder = 1;
    if (overData?.ticketId) {
      const destinationTickets = ticketsByColumn.get(toColumnId) ?? [];
      const overIndex = destinationTickets.findIndex((ticket) => ticket.id === overData.ticketId);
      toOrder = overIndex >= 0 ? overIndex + 1 : destinationTickets.length + 1;
    } else {
      const destinationTickets = ticketsByColumn.get(toColumnId) ?? [];
      toOrder = destinationTickets.length + 1;
    }

    const activeTicket = ticketById.get(ticketId);
    if (!activeTicket) {
      return;
    }

    await onMoveTicket({
      ticketId,
      fromColumnId,
      toColumnId,
      toOrder,
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as
      | { ticketId?: string }
      | undefined;
    setActiveTicketId(activeData?.ticketId ?? null);
  };

  const activeTicket = activeTicketId ? ticketById.get(activeTicketId) ?? null : null;

  if (collaboratorLanes.length === 0) {
    return (
      <div className="rounded-xl bg-white/70 p-6 text-center text-sm text-zinc-500 shadow-sm dark:bg-zinc-900/70 dark:text-zinc-400">
        No hay tickets asignados para mostrar el tablero por colaboradores.
      </div>
    );
  }

  const gridTemplateColumns = `240px repeat(${Math.max(orderedColumns.length, 1)}, minmax(300px, 1fr))`;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(event) => {
        void handleDragEnd(event);
      }}
      onDragCancel={() => setActiveTicketId(null)}
    >
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[1280px] space-y-3">
          <div className="grid gap-3" style={{ gridTemplateColumns }}>
            <div className="px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Colaboradores
              </span>
            </div>
            {orderedColumns.map((column) => {
              const tone = getColumnTone(column.name);
              const count = ticketsByColumn.get(column.id)?.length ?? 0;

              return (
                <div
                  key={`header-${column.id}`}
                  className={`rounded-2xl px-3 py-2 shadow-sm ${headerToneClass[tone]}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{column.name}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badgeToneClass[tone]}`}>
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {collaboratorLanes.map((lane) => {
            const laneColumns = ticketsByLaneAndColumn.get(lane.id);
            const total = laneTotals.get(lane.id) ?? 0;

            return (
              <div key={lane.id} className="grid gap-3" style={{ gridTemplateColumns }}>
                <aside className="rounded-2xl bg-white/85 p-3 shadow-sm dark:bg-zinc-900/75">
                  <div className="mb-1 flex min-w-0 items-center gap-2">
                    {lane.user ? (
                      <MemberAvatar user={lane.user} size="sm" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        SA
                      </div>
                    )}
                    <h4 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{lane.name}</h4>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{total} tickets</p>
                </aside>

                {orderedColumns.map((column) => {
                  const tone = getColumnTone(column.name);
                  const columnTickets = laneColumns?.get(column.id) ?? [];

                  return (
                    <TicketCell
                      key={`${lane.id}-${column.id}`}
                      laneId={lane.id}
                      column={column}
                      columnTickets={columnTickets}
                      canMutate={canMutate}
                      tone={tone}
                      onOpenTicket={onOpenTicket}
                      onCreateTicket={onCreateTicket}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <DragOverlay adjustScale={false} dropAnimation={null}>
        {activeTicket ? (
          <div className="w-[300px] cursor-grabbing opacity-95">
            <TicketCard ticket={activeTicket} onOpen={onOpenTicket} className="shadow-xl shadow-black/20" />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}