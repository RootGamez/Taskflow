import { Button } from "@heroui/react";
import { useDroppable } from "@dnd-kit/core";
import { type ReactNode } from "react";

import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  tickets: Ticket[];
  onOpenTicket: (ticket: Ticket) => void;
  onCreateTicket?: (columnId: string) => void;
  renderTicket?: (ticket: Ticket) => ReactNode;
}

export function KanbanColumn({
  id,
  name,
  color,
  tickets,
  onOpenTicket,
  onCreateTicket,
  renderTicket,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <section ref={setNodeRef} className="w-[320px] shrink-0 rounded-lg border border-zinc-200 bg-zinc-100/60 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
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
          <div key={ticket.id}>
            {renderTicket ? renderTicket(ticket) : <TicketCard ticket={ticket} onOpen={onOpenTicket} />}
          </div>
        ))}
      </div>
      {onCreateTicket ? (
        <Button
          variant="light"
          className="mt-3 w-full text-zinc-600"
          data-column-id={id}
          onPress={() => onCreateTicket(id)}
        >
          + Nuevo ticket
        </Button>
      ) : null}
    </section>
  );
}
