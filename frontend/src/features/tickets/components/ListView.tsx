import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";

import type { Ticket } from "@/features/tickets/types/ticket.types";

interface ListViewProps {
  tickets: Ticket[];
}

export function ListView({ tickets }: ListViewProps) {
  return (
    <Table aria-label="Listado de tickets">
      <TableHeader>
        <TableColumn>Titulo</TableColumn>
        <TableColumn>Prioridad</TableColumn>
        <TableColumn>Fecha limite</TableColumn>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell>{ticket.title}</TableCell>
            <TableCell>{ticket.priority}</TableCell>
            <TableCell>{ticket.due_date ?? "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
