import {
  DndContext,
  DragOverlay,
  TouchSensor,
  MouseSensor,
  closestCenter,
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
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/Sheet";
import type { Column } from "@/features/projects/types/project.types";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { resolveDropOrder } from "@/features/tickets/utils/resolveDropOrder";
import { cn } from "@/lib/utils";

interface KanbanBoardMobileProps {
  columns: Column[];
  tickets: Ticket[];
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

function SortableMobileCard({
  ticket,
  onOpen,
  onRequestMove,
}: {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
  onRequestMove: (ticket: Ticket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
    data: { ticketId: ticket.id, columnId: ticket.column_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* El drag handle es toda la tarjeta con press-and-hold (TouchSensor
          delay), pero dejamos el tap para abrir el ticket. Sin sombra en
          reposo — solo el DragOverlay lleva `shadow-hard`. */}
      <div {...attributes} {...listeners} className="touch-pan-y">
        <TicketCard ticket={ticket} onOpen={onOpen} className="pr-12" />
      </div>
      <button
        type="button"
        aria-label={`Mover ${ticket.title} a otra columna`}
        onClick={() => onRequestMove(ticket)}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center border-2 border-border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-x-px active:translate-y-px"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function KanbanBoardMobile({
  columns,
  tickets,
  allTickets,
  canMutate,
  onOpenTicket,
  onCreateTicket,
  onMoveTicket,
}: KanbanBoardMobileProps) {
  const orderedColumns = useMemo(
    () => [...columns].sort((a, b) => a.order - b.order),
    [columns],
  );

  const [activeColumnId, setActiveColumnId] = useState<string>(
    () => orderedColumns[0]?.id ?? "",
  );
  const [dragTicketId, setDragTicketId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Ticket | null>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Si la columna activa deja de existir (se borró), cae a la primera.
  useEffect(() => {
    if (!orderedColumns.some((column) => column.id === activeColumnId)) {
      setActiveColumnId(orderedColumns[0]?.id ?? "");
    }
  }, [orderedColumns, activeColumnId]);

  // Mantener el chip activo a la vista al cambiar de columna.
  useEffect(() => {
    chipRefs.current.get(activeColumnId)?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeColumnId]);

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  );

  const filteredCountByColumn = useMemo(() => {
    const map = new Map<string, number>();
    for (const ticket of tickets) {
      map.set(ticket.column_id, (map.get(ticket.column_id) ?? 0) + 1);
    }
    return map;
  }, [tickets]);

  const ticketsByColumn = useMemo(() => {
    const map = new Map<string, Ticket[]>();
    for (const column of orderedColumns) map.set(column.id, []);
    for (const ticket of allTickets) {
      if (!map.has(ticket.column_id)) map.set(ticket.column_id, []);
      map.get(ticket.column_id)?.push(ticket);
    }
    for (const [id, list] of map.entries()) {
      map.set(
        id,
        [...list].sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at)),
      );
    }
    return map;
  }, [orderedColumns, allTickets]);

  const ticketById = useMemo(
    () => new Map(allTickets.map((ticket) => [ticket.id, ticket])),
    [allTickets],
  );

  const activeColumn = orderedColumns.find((column) => column.id === activeColumnId) ?? null;

  const visibleTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.column_id === activeColumnId)
        .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at)),
    [tickets, activeColumnId],
  );

  const hadTicketsBeforeFilter = (ticketsByColumn.get(activeColumnId)?.length ?? 0) > 0;

  const handleDragStart = (event: DragStartEvent) => {
    setDragTicketId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragTicketId(null);
    if (!canMutate || !event.over) return;

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    if (activeId === overId) return;

    const moved = ticketById.get(activeId);
    if (!moved) return;

    const toOrder = resolveDropOrder({
      overTicketId: overId,
      toColumnId: activeColumnId,
      ticketsByColumn,
      ticketById,
    });

    await onMoveTicket({
      ticketId: activeId,
      fromColumnId: moved.column_id,
      toColumnId: activeColumnId,
      toOrder,
    });
  };

  const handleConfirmMove = async (toColumnId: string) => {
    const ticket = moveTarget;
    setMoveTarget(null);
    if (!ticket || !canMutate || toColumnId === ticket.column_id) return;

    const toOrder = resolveDropOrder({
      overTicketId: undefined,
      toColumnId,
      ticketsByColumn,
      ticketById,
    });

    await onMoveTicket({
      ticketId: ticket.id,
      fromColumnId: ticket.column_id,
      toColumnId,
      toOrder,
    });
    setActiveColumnId(toColumnId);
  };

  const draggedTicket = dragTicketId ? ticketById.get(dragTicketId) ?? null : null;

  if (orderedColumns.length === 0) {
    return (
      <div className="border-2 border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Este proyecto todavía no tiene columnas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selector de columnas */}
      <div
        className="tf-scroll-contain -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Columnas del tablero"
      >
        {orderedColumns.map((column) => {
          const isActive = column.id === activeColumnId;
          const count = filteredCountByColumn.get(column.id) ?? 0;
          return (
            <button
              key={column.id}
              ref={(el) => {
                if (el) chipRefs.current.set(column.id, el);
                else chipRefs.current.delete(column.id);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveColumnId(column.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 border-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-foreground bg-secondary font-semibold text-foreground shadow-hard-sm"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: column.color }}
                aria-hidden
              />
              <span className="max-w-[9rem] truncate">{column.name}</span>
              <span className="font-mono text-xs tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => setDragTicketId(null)}
      >
        <SortableContext
          items={visibleTickets.map((ticket) => ticket.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {visibleTickets.map((ticket) => (
              <SortableMobileCard
                key={ticket.id}
                ticket={ticket}
                onOpen={onOpenTicket}
                onRequestMove={setMoveTarget}
              />
            ))}

            {visibleTickets.length === 0 ? (
              <p className="border-2 border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {hadTicketsBeforeFilter
                  ? "Ningún ticket de esta columna coincide con el filtro."
                  : "No hay tickets en esta columna."}
              </p>
            ) : null}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {draggedTicket ? (
            <TicketCard
              ticket={draggedTicket}
              onOpen={onOpenTicket}
              className="shadow-hard dark:shadow-hard-float"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {canMutate && activeColumn ? (
        <button
          type="button"
          onClick={() => onCreateTicket(activeColumn.id)}
          className="w-full border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + Crear tarea en {activeColumn.name}
        </button>
      ) : null}

      {/* Hoja "Mover a…" */}
      <Sheet open={moveTarget !== null} onOpenChange={(open) => (!open ? setMoveTarget(null) : undefined)}>
        <SheetContent side="bottom" className="pb-6">
          <SheetHeader>
            <SheetTitle>Mover ticket</SheetTitle>
            <p className="truncate text-sm text-muted-foreground">{moveTarget?.title}</p>
          </SheetHeader>
          <div className="tf-scroll-contain max-h-[50dvh] overflow-y-auto px-2 pb-2">
            {orderedColumns.map((column) => {
              const isCurrent = column.id === moveTarget?.column_id;
              return (
                <button
                  key={column.id}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => void handleConfirmMove(column.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-3 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCurrent
                      ? "cursor-default text-muted-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="boxed-icon h-4 w-4" style={{ backgroundColor: column.color }} aria-hidden />
                    {column.name}
                  </span>
                  {isCurrent ? (
                    <span className="eyebrow">Actual</span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
