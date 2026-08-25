import { useDraggable } from "@dnd-kit/core";

import type { Ticket } from "@/features/tickets/types/ticket.types";
import { getCalendarTicketDragId } from "@/features/calendar/utils/resolveCalendarDrop";
import { isDueDateOverdue } from "@/features/tickets/utils/dueDate";
import { cn } from "@/lib/utils";

interface CalendarTicketChipProps {
  ticket: Ticket;
  /** Si es false, el chip no se puede arrastrar (sin permiso de mutar). */
  canDrag: boolean;
  onOpen: (ticket: Ticket) => void;
}

/**
 * Chip individual de ticket dentro de una celda del calendario. Vencido
 * (`due_date` < hoy) usa el token de prioridad urgente ya existente
 * (`bg-priority-urgent-bg text-priority-urgent`); futuro usa tono neutro
 * (`bg-muted text-foreground`) — sección 8.2 del sistema de diseño.
 */
export function CalendarTicketChip({ ticket, canDrag, onOpen }: CalendarTicketChipProps) {
  const isOverdue = isDueDateOverdue(ticket.due_date);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getCalendarTicketDragId(ticket.id),
    disabled: !canDrag,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      onClick={() => onOpen(ticket)}
      title={ticket.title}
      className={cn(
        "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium transition-opacity",
        isOverdue ? "bg-priority-urgent-bg text-priority-urgent" : "bg-muted text-foreground",
        canDrag ? "cursor-grab touch-none active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-40",
      )}
    >
      {ticket.title}
    </button>
  );
}
