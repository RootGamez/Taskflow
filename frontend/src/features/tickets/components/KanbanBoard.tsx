import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";

import type { Column } from "@/features/projects/types/project.types";
import { KanbanColumn } from "@/features/tickets/components/KanbanColumn";
import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface KanbanBoardProps {
  columns: Column[];
  tickets: Ticket[];
  onOpenTicket: (ticket: Ticket) => void;
  onCreateTicket: (columnId: string) => void;
  onMoveTicket: (payload: {
    ticketId: string;
    fromColumnId: string;
    toColumnId: string;
    toOrder: number;
  }) => void | Promise<void>;
}

function SortableTicketCard({
  ticket,
  onOpen,
}: {
  ticket: Ticket;
  onOpen: (ticket: Ticket) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: ticket.id,
    data: {
      ticket,
      columnId: ticket.column_id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} onOpen={onOpen} />
    </div>
  );
}

export function KanbanBoard({
  columns,
  tickets,
  onOpenTicket,
  onCreateTicket,
  onMoveTicket,
}: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const ticketsByColumn = useMemo(() => {
    const mapping = new Map<string, Ticket[]>();
    for (const column of columns) {
      mapping.set(column.id, []);
    }
    for (const ticket of tickets) {
      if (!mapping.has(ticket.column_id)) {
        mapping.set(ticket.column_id, []);
      }
      mapping.get(ticket.column_id)?.push(ticket);
    }
    for (const [key, columnTickets] of mapping.entries()) {
      mapping.set(
        key,
        [...columnTickets].sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at)),
      );
    }
    return mapping;
  }, [columns, tickets]);

  const ticketById = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.id, ticket])),
    [tickets],
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeTicket = ticketById.get(String(event.active.id));
    if (!activeTicket || !event.over) {
      return;
    }

    const overTicket = ticketById.get(String(event.over.id));
    if (overTicket) {
      const targetColumnTickets = ticketsByColumn.get(overTicket.column_id) ?? [];
      const toOrder = targetColumnTickets.findIndex((ticket) => ticket.id === overTicket.id) + 1;

      if (toOrder <= 0) {
        return;
      }

      await onMoveTicket({
        ticketId: activeTicket.id,
        fromColumnId: activeTicket.column_id,
        toColumnId: overTicket.column_id,
        toOrder,
      });
      return;
    }

    const destinationColumnId = String(event.over.id);
    const destinationColumnTickets = ticketsByColumn.get(destinationColumnId);
    if (!destinationColumnTickets) {
      return;
    }

    await onMoveTicket({
      ticketId: activeTicket.id,
      fromColumnId: activeTicket.column_id,
      toColumnId: destinationColumnId,
      toOrder: destinationColumnTickets.length + 1,
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => {
      void handleDragEnd(event);
    }}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => {
          const columnTickets = ticketsByColumn.get(column.id) ?? [];

          return (
            <SortableContext
              key={column.id}
              id={column.id}
              items={columnTickets.map((ticket) => ticket.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                id={column.id}
                name={column.name}
                color={column.color}
                tickets={columnTickets}
                onOpenTicket={onOpenTicket}
                onCreateTicket={onCreateTicket}
                renderTicket={(ticket) => <SortableTicketCard ticket={ticket} onOpen={onOpenTicket} />}
              />
            </SortableContext>
          );
        })}
      </div>
    </DndContext>
  );
}
