import { useDroppable } from "@dnd-kit/core";

import { CalendarTicketChip } from "@/features/calendar/components/CalendarTicketChip";
import { formatCalendarDayKey } from "@/features/calendar/utils/groupTicketsByDay";
import { getCalendarDayDropId } from "@/features/calendar/utils/resolveCalendarDrop";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_TICKETS = 3;

interface CalendarDayCellProps {
  /** Medianoche UTC del día que representa esta celda. */
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
}

/**
 * Celda de día del calendario: hasta 3 chips de ticket apilados + "+N más"
 * si hay más (mismo patrón que Google Calendar/Notion — sección 8.2 del
 * sistema de diseño). `useDroppable` la vuelve destino válido de drop.
 */
export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  tickets,
  canMutate,
  onOpenTicket,
}: CalendarDayCellProps) {
  const dayKey = formatCalendarDayKey(date);
  const { setNodeRef, isOver } = useDroppable({
    id: getCalendarDayDropId(dayKey),
    disabled: !canMutate,
  });

  const visibleTickets = tickets.slice(0, MAX_VISIBLE_TICKETS);
  const overflowCount = tickets.length - visibleTickets.length;

  return (
    <div
      ref={setNodeRef}
      data-testid={`calendar-day-cell-${dayKey}`}
      className={cn(
        "flex min-h-[68px] flex-col gap-1 overflow-hidden p-1 transition-colors sm:min-h-[104px] sm:p-1.5",
        isCurrentMonth ? "bg-card" : "bg-muted",
        isOver && "relative z-10 ring-2 ring-inset ring-ring",
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center px-1 font-mono text-xs font-semibold tabular-nums",
          isCurrentMonth ? "text-foreground" : "text-muted-foreground",
          isToday && "bg-primary text-primary-foreground",
        )}
      >
        {date.getUTCDate()}
      </span>

      <div className="flex flex-1 flex-col gap-1">
        {visibleTickets.map((ticket) => (
          <CalendarTicketChip key={ticket.id} ticket={ticket} canDrag={canMutate} onOpen={onOpenTicket} />
        ))}
        {overflowCount > 0 ? (
          <span className="px-1 font-mono text-xs text-muted-foreground">+{overflowCount} más</span>
        ) : null}
      </div>
    </div>
  );
}
