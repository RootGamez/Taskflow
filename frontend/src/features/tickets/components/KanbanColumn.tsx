import { Button } from "@heroui/react";
import { useDroppable } from "@dnd-kit/core";
import { type ReactNode } from "react";

import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";

type ColumnTone = "backlog" | "progress" | "done" | "default";

function getColumnTone(name: string): ColumnTone {
  const normalizedName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizedName.includes("backlog") || normalizedName.includes("pendiente") || normalizedName.includes("por hacer") || normalizedName.includes("to do")) {
    return "backlog";
  }

  if (normalizedName.includes("en progreso") || normalizedName.includes("progreso") || normalizedName.includes("in progress") || normalizedName.includes("doing") || normalizedName.includes("en curso")) {
    return "progress";
  }

  if (normalizedName.includes("hecho") || normalizedName.includes("done") || normalizedName.includes("completado") || normalizedName.includes("finalizado")) {
    return "done";
  }

  return "default";
}

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
  const tone = getColumnTone(name);

  const columnToneClass: Record<ColumnTone, string> = {
    backlog: "border-zinc-300 bg-zinc-100/90 dark:border-zinc-700 dark:bg-zinc-900/65",
    progress: "border-blue-200 bg-blue-50/85 dark:border-blue-900 dark:bg-blue-950/30",
    done: "border-emerald-200 bg-emerald-50/85 dark:border-emerald-900 dark:bg-emerald-950/30",
    default: "border-zinc-200 bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/50",
  };

  const laneToneClass: Record<ColumnTone, string> = {
    backlog: "border-zinc-300/90",
    progress: "border-blue-300/90",
    done: "border-emerald-300/90",
    default: "border-zinc-300/70",
  };

  const badgeToneClass: Record<ColumnTone, string> = {
    backlog: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    default: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <section
      ref={setNodeRef}
      className={`w-[320px] shrink-0 rounded-lg border p-3 ${columnToneClass[tone]}`}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{name}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${badgeToneClass[tone]}`}>
          {tickets.length}
        </span>
      </header>
      <div className={`space-y-3 border-l-2 pl-3 ${laneToneClass[tone]}`}>
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
