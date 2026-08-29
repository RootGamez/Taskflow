import { Badge } from "@/components/ui/shadcn/badge";
import { LabelChip } from "@/features/labels/components/LabelChip";
import { PRIORITY_STYLES } from "@/features/tickets/lib/priorityStyles";
import type { Priority, Ticket } from "@/features/tickets/types/ticket.types";
import { formatDueDateDayMonth, isDueDateOverdue } from "@/features/tickets/utils/dueDate";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";

interface ListViewProps {
  tickets: Ticket[];
  onOpenTicket?: (ticket: Ticket) => void;
}

/**
 * Prioridad con ícono + texto (nunca solo color, regla `color-not-only`).
 * `urgent` usa el sello rotado (`Badge variant="stamp"`); el resto, un badge
 * con borde sólido del color de la prioridad.
 */
function PriorityTag({ priority }: { priority: Priority }) {
  const style = PRIORITY_STYLES[priority];
  const Icon = style.Icon;

  if (priority === "urgent") {
    return (
      <Badge variant="stamp">
        <Icon />
        {style.label}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={cn(style.bgClass, style.textClass, style.borderClass)}
    >
      <Icon />
      {style.label}
    </Badge>
  );
}

function MobileTicketRow({
  ticket,
  onOpenTicket,
}: {
  ticket: Ticket;
  onOpenTicket?: (ticket: Ticket) => void;
}) {
  const overdue = isDueDateOverdue(ticket.due_date);

  return (
    <button
      type="button"
      onClick={() => onOpenTicket?.(ticket)}
      className="w-full border-2 border-border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{ticket.title}</p>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {ticket.reference ?? "—"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityTag priority={ticket.priority} />
        {ticket.due_date ? (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
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

const HEAD_CELL = "eyebrow px-3 py-2";

export function ListView({ tickets, onOpenTicket }: ListViewProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="space-y-2">
        {tickets.map((ticket) => (
          <MobileTicketRow key={ticket.id} ticket={ticket} onOpenTicket={onOpenTicket} />
        ))}
        {tickets.length === 0 ? (
          <p className="border-2 border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No hay tickets para mostrar.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border-2 border-border">
      <table aria-label="Listado de tickets" className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-border bg-secondary text-left">
            <th scope="col" className={HEAD_CELL}>Ref</th>
            <th scope="col" className={HEAD_CELL}>Titulo</th>
            <th scope="col" className={HEAD_CELL}>Prioridad</th>
            <th scope="col" className={HEAD_CELL}>Labels</th>
            <th scope="col" className={cn(HEAD_CELL, "text-right")}>Fecha limite</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => {
            const overdue = isDueDateOverdue(ticket.due_date);

            return (
              <tr
                key={ticket.id}
                className={cn(
                  "border-b border-border last:border-b-0 transition-colors",
                  onOpenTicket && "cursor-pointer hover:bg-accent",
                )}
                onClick={() => onOpenTicket?.(ticket)}
              >
                <td className="px-3 py-2 align-middle">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {ticket.reference ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-foreground">{ticket.title}</td>
                <td className="px-3 py-2 align-middle">
                  <PriorityTag priority={ticket.priority} />
                </td>
                <td className="px-3 py-2 align-middle">
                  <div className="flex flex-wrap gap-1">
                    {ticket.labels.map((label) => (
                      <LabelChip key={label.id} label={label} />
                    ))}
                  </div>
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      overdue ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatDueDateDayMonth(ticket.due_date)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {tickets.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
          No hay tickets para mostrar.
        </p>
      ) : null}
    </div>
  );
}
