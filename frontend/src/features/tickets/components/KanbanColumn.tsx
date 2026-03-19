import { Button } from "@heroui/react";

import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  tickets: Ticket[];
  onOpenTicket: (ticket: Ticket) => void;
}

export function KanbanColumn({ id, name, color, tickets, onOpenTicket }: KanbanColumnProps) {
  return (
    <section className="w-[320px] shrink-0 rounded-lg border border-zinc-200 bg-zinc-100/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{name}</h3>
        </div>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {tickets.length}
        </span>
      </header>
      <div className="space-y-3">
        {tickets.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onOpen={onOpenTicket} />
        ))}
      </div>
      <Button variant="light" className="mt-3 w-full text-zinc-600" data-column-id={id}>
        + Nuevo ticket
      </Button>
    </section>
  );
}
