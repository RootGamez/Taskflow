import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";

import { LabelChip } from "@/features/labels/components/LabelChip";
import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { formatDueDateDayMonth, isDueDateOverdue } from "@/features/tickets/utils/dueDate";
import { useIsMobile } from "@/hooks/useBreakpoint";

interface ListViewProps {
  tickets: Ticket[];
  onOpenTicket?: (ticket: Ticket) => void;
}

function MobileTicketRow({
  ticket,
  onOpenTicket,
}: {
  ticket: Ticket;
  onOpenTicket?: (ticket: Ticket) => void;
}) {
  const priorityStyle = PRIORITY_STYLES[ticket.priority];
  const PriorityIcon = priorityStyle.Icon;
  const overdue = isDueDateOverdue(ticket.due_date);

  return (
    <button
      type="button"
      onClick={() => onOpenTicket?.(ticket)}
      className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">{ticket.title}</p>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{ticket.reference ?? "—"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${priorityStyle.bgClass} ${priorityStyle.textClass}`}
        >
          <PriorityIcon className="h-3.5 w-3.5" />
          {priorityStyle.label}
        </span>
        {ticket.due_date ? (
          <span className={`text-xs ${overdue ? "text-destructive" : "text-zinc-500"}`}>
            {formatDueDateDayMonth(ticket.due_date)}
          </span>
        ) : null}
        {ticket.labels.map((label) => (
          <LabelChip key={label.id} label={label} />
        ))}
      </div>
    </button>
  );
}

export function ListView({ tickets, onOpenTicket }: ListViewProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <MobileTicketRow key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} />
        ))}
        {tickets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No hay tickets para mostrar.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="Listado de tickets">
        <TableHeader>
          <TableColumn>Ref</TableColumn>
          <TableColumn>Titulo</TableColumn>
          <TableColumn>Prioridad</TableColumn>
          <TableColumn>Labels</TableColumn>
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
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{ticket.reference ?? "—"}</span>
                </TableCell>
                <TableCell>{ticket.title}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${priorityStyle.bgClass} ${priorityStyle.textClass}`}
                  >
                    <PriorityIcon className="h-4 w-4" />
                    {priorityStyle.label}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {ticket.labels.map((label) => (
                      <LabelChip key={label.id} label={label} />
                    ))}
                  </div>
                </TableCell>
                <TableCell>{formatDueDateDayMonth(ticket.due_date)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
