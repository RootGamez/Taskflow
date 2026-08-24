import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";

import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { formatDueDateDayMonth } from "@/features/tickets/utils/dueDate";

interface ListViewProps {
  tickets: Ticket[];
  onOpenTicket?: (ticket: Ticket) => void;
}

export function ListView({ tickets, onOpenTicket }: ListViewProps) {
  return (
    <Table aria-label="Listado de tickets">
      <TableHeader>
        <TableColumn>Titulo</TableColumn>
        <TableColumn>Prioridad</TableColumn>
        <TableColumn>Fecha limite</TableColumn>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => {
          const priorityStyle = PRIORITY_STYLES[ticket.priority];
          const PriorityIcon = priorityStyle.Icon;

          return (
            <TableRow
              key={ticket.id}
              className={onOpenTicket ? "cursor-pointer" : ""}
              onClick={() => onOpenTicket?.(ticket)}
            >
              <TableCell>{ticket.title}</TableCell>
              <TableCell>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${priorityStyle.bgClass} ${priorityStyle.textClass}`}
                >
                  <PriorityIcon className="h-4 w-4" />
                  {priorityStyle.label}
                </span>
              </TableCell>
              <TableCell>{formatDueDateDayMonth(ticket.due_date)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
