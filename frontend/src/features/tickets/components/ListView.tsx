import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";

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
        {tickets.map((ticket) => (
          <TableRow
            key={ticket.id}
            className={onOpenTicket ? "cursor-pointer" : ""}
            onClick={() => onOpenTicket?.(ticket)}
          >
            <TableCell>{ticket.title}</TableCell>
            <TableCell>{ticket.priority}</TableCell>
            <TableCell>{formatDueDateDayMonth(ticket.due_date)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
