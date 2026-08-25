import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { CalendarDayCell } from "@/features/calendar/components/CalendarDayCell";
import { CalendarToolbar } from "@/features/calendar/components/CalendarToolbar";
import { buildMonthGrid } from "@/features/calendar/utils/buildMonthGrid";
import { formatCalendarDayKey, groupTicketsByDay } from "@/features/calendar/utils/groupTicketsByDay";
import { resolveCalendarDrop } from "@/features/calendar/utils/resolveCalendarDrop";
import type { Ticket } from "@/features/tickets/types/ticket.types";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const POINTER_ACTIVATION_DISTANCE_PX = 6;

interface MonthCursor {
  year: number;
  month: number;
}

function shiftMonth(cursor: MonthCursor, delta: 1 | -1): MonthCursor {
  const totalMonths = cursor.year * 12 + cursor.month + delta;
  return {
    year: Math.floor(totalMonths / 12),
    month: ((totalMonths % 12) + 12) % 12,
  };
}

interface CalendarGridProps {
  tickets: Ticket[];
  canMutate: boolean;
  onOpenTicket: (ticket: Ticket) => void;
  onDropTicket: (result: { ticketId: string; dueDate: string }) => void | Promise<void>;
  /** Inyectable para tests deterministas; por defecto "ahora". */
  now?: Date;
}

/**
 * Orquesta la vista de calendario: toolbar de navegación + grilla de 6
 * semanas x 7 días + drag & drop de tickets entre días (`DndContext` de
 * `@dnd-kit/core`). A diferencia del Kanban, no hay `SortableContext` ni
 * reordenamiento interno: cada celda es un único `droppable` y solo importa
 * a qué día se soltó.
 */
export function CalendarGrid({ tickets, canMutate, onOpenTicket, onDropTicket, now = new Date() }: CalendarGridProps) {
  const [cursor, setCursor] = useState<MonthCursor>(() => ({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth(),
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: POINTER_ACTIVATION_DISTANCE_PX } }),
  );

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor.year, cursor.month]);
  const ticketsByDay = useMemo(() => groupTicketsByDay(tickets), [tickets]);
  const todayKey = useMemo(() => formatCalendarDayKey(now), [now]);

  const handlePrevMonth = () => setCursor((prev) => shiftMonth(prev, -1));
  const handleNextMonth = () => setCursor((prev) => shiftMonth(prev, 1));
  const handleToday = () => setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() });

  const handleDragEnd = (event: DragEndEvent) => {
    if (!canMutate) {
      return;
    }

    const result = resolveCalendarDrop({
      activeId: String(event.active.id),
      overId: event.over ? String(event.over.id) : null,
    });

    if (result) {
      void onDropTicket(result);
    }
  };

  return (
    <div className="space-y-3">
      <CalendarToolbar
        year={cursor.year}
        month={cursor.month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-1 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}

          {weeks.flat().map((date) => {
            const dayKey = formatCalendarDayKey(date);
            return (
              <CalendarDayCell
                key={dayKey}
                date={date}
                isCurrentMonth={date.getUTCMonth() === cursor.month}
                isToday={dayKey === todayKey}
                tickets={ticketsByDay.get(dayKey) ?? []}
                canMutate={canMutate}
                onOpenTicket={onOpenTicket}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
