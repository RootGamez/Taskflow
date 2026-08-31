import { useMemo, useState, type ReactNode } from "react";
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
import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { cn } from "@/lib/utils";

/** Columna del tablero: un estado del espacio, o una columna de proyecto. */
export interface BoardColumn {
  id: string;
  name: string;
  color: string;
}

/** Fila del tablero: un colaborador, un proyecto, lo que agrupe la vista. */
export interface BoardLane {
  id: string;
  name: string;
}

interface LaneBoardProps<TLane extends BoardLane> {
  /** Ya ordenadas: el tablero las pinta en el orden recibido. */
  columns: BoardColumn[];
  lanes: TLane[];
  /** Matriz fila × columna, con todas las celdas presentes (ver `groupTicketsByLaneAndStatus`). */
  ticketsByLaneAndColumn: Map<string, Map<string, Ticket[]>>;
  /** Total por columna para el badge del encabezado (cuenta cada ticket una vez). */
  countByColumn: Map<string, number>;
  /** Título de la columna de filas ("Colaboradores", "Proyectos"…). */
  laneColumnLabel: string;
  renderLaneHeader: (lane: TLane, total: number) => ReactNode;
  /** Por ticket: en "Mis tareas" el permiso depende del espacio de cada uno. */
  canDragTicket: (ticket: Ticket) => boolean;
  /** Muestra el proyecto en la tarjeta. Redundante cuando las filas YA son proyectos. */
  showProjectOnCard?: boolean;
  emptyMessage: string;
  onOpenTicket: (ticket: Ticket) => void;
  /** Soltar en una celda: solo cuenta la columna destino, nunca la fila. */
  onDropTicket: (ticket: Ticket, columnId: string) => void;
  /** Avisos bajo el tablero (ej. tickets que no caen en ninguna columna). */
  footer?: ReactNode;
}

function getCellDropId(laneId: string, columnId: string) {
  return `cell::${laneId}::${columnId}`;
}

function getTicketDragId(ticketId: string, laneId: string) {
  return `ticket::${ticketId}::${laneId}`;
}

function DraggableCard({
  ticket,
  laneId,
  canDrag,
  showProject,
  onOpen,
  accentColor,
}: {
  ticket: Ticket;
  laneId: string;
  canDrag: boolean;
  showProject: boolean;
  onOpen: (ticket: Ticket) => void;
  accentColor?: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // Un ticket puede repetirse en varias filas (dos responsables): el id de
    // drag lleva la fila para que cada copia sea un draggable distinto.
    id: getTicketDragId(ticket.id, laneId),
    disabled: !canDrag,
    data: { ticket },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "touch-none select-none",
        canDrag && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <TicketCard
        ticket={ticket}
        onOpen={onOpen}
        showProject={showProject}
        accentColor={accentColor}
      />
    </div>
  );
}

function TicketCell({
  laneId,
  column,
  tickets,
  canDragTicket,
  showProjectOnCard,
  onOpenTicket,
}: {
  laneId: string;
  column: BoardColumn;
  tickets: Ticket[];
  canDragTicket: (ticket: Ticket) => boolean;
  showProjectOnCard: boolean;
  onOpenTicket: (ticket: Ticket) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: getCellDropId(laneId, column.id),
    data: { laneId, columnId: column.id, type: "cell" },
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
            canDrag={canDragTicket(ticket)}
            showProject={showProjectOnCard}
            onOpen={onOpenTicket}
            accentColor={column.color}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Grilla filas × columnas del tablero (escritorio). Es deliberadamente tonta:
 * recibe filas, columnas y la matriz ya armada, y solo sabe pintarlas y
 * resolver el drop. Quién es una fila (colaborador, proyecto) y qué significa
 * soltar en una columna lo decide cada tablero que la usa.
 */
export function LaneBoard<TLane extends BoardLane>({
  columns,
  lanes,
  ticketsByLaneAndColumn,
  countByColumn,
  laneColumnLabel,
  renderLaneHeader,
  canDragTicket,
  showProjectOnCard = false,
  emptyMessage,
  onOpenTicket,
  onDropTicket,
  footer,
}: LaneBoardProps<TLane>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const laneTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [laneId, cells] of ticketsByLaneAndColumn.entries()) {
      let total = 0;
      for (const cellTickets of cells.values()) total += cellTickets.length;
      totals.set(laneId, total);
    }
    return totals;
  }, [ticketsByLaneAndColumn]);

  // Un solo barrido de la matriz: el ticket que se arrastra y la columna en
  // la que estaba, para pintar el overlay con el color de esa columna.
  const active = useMemo(() => {
    if (!activeDragId) return null;
    const [, ticketId] = activeDragId.split("::");
    if (!ticketId) return null;

    for (const cells of ticketsByLaneAndColumn.values()) {
      for (const [columnId, cellTickets] of cells.entries()) {
        const found = cellTickets.find((ticket) => ticket.id === ticketId);
        if (found) return { ticket: found, columnId };
      }
    }
    return null;
  }, [activeDragId, ticketsByLaneAndColumn]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    if (!event.over) return;

    const ticket = event.active.data.current?.ticket as Ticket | undefined;
    const columnId = (event.over.data.current as { columnId?: string } | undefined)?.columnId;
    if (!ticket || !columnId || !canDragTicket(ticket)) return;

    onDropTicket(ticket, columnId);
  };

  if (lanes.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const gridTemplateColumns = `240px repeat(${Math.max(columns.length, 1)}, minmax(300px, 1fr))`;

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
              <span className="eyebrow">{laneColumnLabel}</span>
            </div>
            {columns.map((column) => (
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
                    {countByColumn.get(column.id) ?? 0}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {lanes.map((lane) => {
            const cells = ticketsByLaneAndColumn.get(lane.id);

            return (
              <div key={lane.id} className="grid gap-3" style={{ gridTemplateColumns }}>
                <aside className="border-2 border-border bg-card p-3">
                  {renderLaneHeader(lane, laneTotals.get(lane.id) ?? 0)}
                </aside>

                {columns.map((column) => (
                  <TicketCell
                    key={`${lane.id}-${column.id}`}
                    laneId={lane.id}
                    column={column}
                    tickets={cells?.get(column.id) ?? []}
                    canDragTicket={canDragTicket}
                    showProjectOnCard={showProjectOnCard}
                    onOpenTicket={onOpenTicket}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {footer}

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[300px] rotate-1 cursor-grabbing">
            <TicketCard
              ticket={active.ticket}
              onOpen={onOpenTicket}
              showProject={showProjectOnCard}
              accentColor={columns.find((column) => column.id === active.columnId)?.color}
              className="shadow-hard dark:shadow-hard-float"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
