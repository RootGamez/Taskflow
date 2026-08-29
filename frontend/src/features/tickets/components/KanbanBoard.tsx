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

import { Badge } from "@/components/ui/shadcn/badge";
import type { Column } from "@/features/projects/types/project.types";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { resolveDropOrder } from "@/features/tickets/utils/resolveDropOrder";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  columns: Column[];
  /** Tickets a renderizar (puede venir filtrado, ej. por fecha). */
  tickets: Ticket[];
  /**
   * Lista SIN filtrar. Se usa para calcular el destino real de un drag
   * (order real, largo real de columna) para que un filtro activo nunca
   * corrompa el order de tickets ocultos por ese filtro.
   */
  allTickets: Ticket[];
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

interface CollaboratorLane {
  id: string;
  name: string;
  user: Ticket["assignees"][number] | null;
}

const UNASSIGNED_LANE_ID = "__unassigned__";

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
  onOpen,
  accentColor,
}: {
  ticket: Ticket;
  laneId: string;
  onOpen: (ticket: Ticket) => void;
  accentColor?: string;
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
      {/* Sin sombra en reposo — el borde grueso da el peso. La sombra dura
          solo aparece en el DragOverlay mientras se arrastra. */}
      <TicketCard ticket={ticket} onOpen={onOpen} accentColor={accentColor} />
    </div>
  );
}

function TicketCell({
  laneId,
  column,
  columnTickets,
  canMutate,
  isFilteredEmpty,
  onOpenTicket,
  onCreateTicket,
}: {
  laneId: string;
  column: Column;
  columnTickets: Ticket[];
  canMutate: boolean;
  /** true cuando esta celda no tiene tickets visibles SOLO por el filtro de fecha activo. */
  isFilteredEmpty: boolean;
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

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "border-2 bg-background p-2 transition-colors",
        isOver ? "border-primary ring-2 ring-ring" : "border-border",
      )}
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
              onOpen={onOpenTicket}
              accentColor={column.color}
            />
          ))}
          {isFilteredEmpty ? (
            <p className="border-2 border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
              Ningún ticket coincide con el filtro de fecha
            </p>
          ) : null}
        </div>
      </SortableContext>

      {canMutate ? (
        <button
          type="button"
          onClick={() => onCreateTicket(column.id)}
          className="mt-2 w-full border-2 border-dashed border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  allTickets,
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

  // Deriva de allTickets (sin filtrar): las filas de colaborador no deben
  // desaparecer solo porque el filtro de fecha oculta todos los tickets
  // visibles de esa persona en este momento — para ese caso está el placeholder
  // de "ningún ticket coincide" por celda, no la desaparición de la fila entera.
  const collaboratorLanes = useMemo(() => {
    const mapping = new Map<string, CollaboratorLane>();

    for (const ticket of allTickets) {
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

    const hasUnassigned = allTickets.some((ticket) => ticket.assignees.length === 0);
    if (hasUnassigned) {
      lanes.push({ id: UNASSIGNED_LANE_ID, name: "Sin asignar", user: null });
    }

    return lanes;
  }, [allTickets]);

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

  // Deriva SIEMPRE de allTickets (sin filtrar): se usa para calcular el
  // destino real de un drag (ver resolveDropOrder), que no debe verse
  // afectado por un filtro de fecha activo en `tickets`.
  const ticketsByColumn = useMemo(() => {
    const mapping = new Map<string, Ticket[]>();
    for (const column of orderedColumns) {
      mapping.set(column.id, []);
    }
    for (const ticket of allTickets) {
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
  }, [orderedColumns, allTickets]);

  // Idem: deriva de allTickets para resolver el ticket bajo el cursor con su
  // order real, sin importar si está oculto por el filtro activo.
  const ticketById = useMemo(
    () => new Map(allTickets.map((ticket) => [ticket.id, ticket])),
    [allTickets],
  );

  // Conteo FILTRADO por columna, para el badge del header (debe reflejar lo
  // que el usuario está viendo, no el total real).
  const filteredCountByColumn = useMemo(() => {
    const mapping = new Map<string, number>();
    for (const ticket of tickets) {
      mapping.set(ticket.column_id, (mapping.get(ticket.column_id) ?? 0) + 1);
    }
    return mapping;
  }, [tickets]);

  // Conteo SIN filtrar por lane+columna, para distinguir en cada celda si
  // está vacía porque nunca hubo tickets ahí o porque el filtro de fecha
  // ocultó los que sí había.
  const allTicketsCountByLaneColumn = useMemo(() => {
    const mapping = new Map<string, number>();
    for (const ticket of allTickets) {
      const targetLaneIds =
        ticket.assignees.length === 0
          ? [UNASSIGNED_LANE_ID]
          : ticket.assignees.map((assignee) => assignee.id);

      for (const laneId of targetLaneIds) {
        const key = `${laneId}::${ticket.column_id}`;
        mapping.set(key, (mapping.get(key) ?? 0) + 1);
      }
    }
    return mapping;
  }, [allTickets]);

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

    const toOrder = resolveDropOrder({
      overTicketId: overData?.ticketId,
      toColumnId,
      ticketsByColumn,
      ticketById,
    });

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
      <div className="border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
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
            <div className="flex items-end px-3 py-2">
              <span className="eyebrow">Colaboradores</span>
            </div>
            {orderedColumns.map((column) => {
              const count = filteredCountByColumn.get(column.id) ?? 0;

              return (
                <div key={`header-${column.id}`} className="border-2 border-border bg-card">
                  {/* Color arbitrario del usuario: barra superior de 3px, nunca
                      fondo del texto (DESIGN_SYSTEM.md §3). */}
                  <div
                    className="h-[3px] w-full"
                    style={{ backgroundColor: column.color }}
                    aria-hidden
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <h3 className="truncate font-display text-sm font-bold uppercase tracking-wide text-foreground">
                      {column.name}
                    </h3>
                    <Badge variant="secondary" mono>
                      {count}
                    </Badge>
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
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">{total} tickets</p>
                </aside>

                {orderedColumns.map((column) => {
                  const columnTickets = laneColumns?.get(column.id) ?? [];
                  const hadTicketsBeforeFilter =
                    (allTicketsCountByLaneColumn.get(`${lane.id}::${column.id}`) ?? 0) > 0;
                  const isFilteredEmpty = columnTickets.length === 0 && hadTicketsBeforeFilter;

                  return (
                    <TicketCell
                      key={`${lane.id}-${column.id}`}
                      laneId={lane.id}
                      column={column}
                      columnTickets={columnTickets}
                      canMutate={canMutate}
                      isFilteredEmpty={isFilteredEmpty}
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
            {/* Sombra dura SOLO mientras se arrastra (dark: sombra flotante). */}
            <TicketCard
              ticket={activeTicket}
              onOpen={onOpenTicket}
              accentColor={orderedColumns.find((c) => c.id === activeTicket.column_id)?.color}
              className="shadow-hard dark:shadow-hard-float"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}