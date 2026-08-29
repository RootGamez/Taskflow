import { Button } from "@heroui/react";
import { useDroppable } from "@dnd-kit/core";
import { type ReactNode } from "react";

import { Badge } from "@/components/ui/shadcn/badge";
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
    <section ref={setNodeRef} className="w-[320px] shrink-0 border-2 border-border bg-card p-3">
      <header className="mb-3 flex items-center justify-between gap-2 border-b-2 border-border pb-2">
        <div className="flex min-w-0 items-center gap-2">
          {/* Color arbitrario del usuario: punto dentro de un cuadrado
              bordeado (`.boxed-icon`), nunca fondo del texto — DESIGN_SYSTEM §3. */}
          <span
            className="boxed-icon h-4 w-4 shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <h3 className="truncate font-display text-sm font-bold uppercase tracking-wide text-foreground">
            {name}
          </h3>
        </div>
        <Badge variant="secondary" mono>
          {tickets.length}
        </Badge>
      </header>
      <div className="space-y-3 border-l-2 border-border pl-3">
        {tickets.map((ticket) => (
          <div key={ticket.id}>
            {renderTicket ? renderTicket(ticket) : <TicketCard ticket={ticket} onOpen={onOpenTicket} />}
          </div>
        ))}
      </div>
      {onCreateTicket ? (
        <Button
          variant="light"
          className="mt-3 w-full rounded-none text-muted-foreground"
          data-column-id={id}
          onPress={() => onCreateTicket(id)}
        >
          + Nuevo ticket
        </Button>
      ) : null}
    </section>
  );
}
