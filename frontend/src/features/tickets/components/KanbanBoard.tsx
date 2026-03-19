import type { Column } from "@/features/projects/types/project.types";
import { KanbanColumn } from "@/features/tickets/components/KanbanColumn";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface KanbanBoardProps {
  columns: Column[];
  tickets: Ticket[];
  onOpenTicket: (ticket: Ticket) => void;
}

export function KanbanBoard({ columns, tickets, onOpenTicket }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          id={column.id}
          name={column.name}
          color={column.color}
          tickets={tickets.filter((ticket) => ticket.column_id === column.id)}
          onOpenTicket={onOpenTicket}
        />
      ))}
    </div>
  );
}
