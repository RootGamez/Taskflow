import { buildDueDateFromCalendarDay } from "@/features/calendar/utils/buildDueDateFromDay";

const TICKET_DRAG_ID_PREFIX = "calendar-ticket::";
const DAY_DROP_ID_PREFIX = "calendar-day::";
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** id de `useDraggable` para un chip de ticket en el calendario. */
export function getCalendarTicketDragId(ticketId: string): string {
  return `${TICKET_DRAG_ID_PREFIX}${ticketId}`;
}

/**
 * id de `useDroppable` para una celda de día del calendario. `dayKey` debe
 * venir de `formatCalendarDayKey` (misma fuente que agrupa los tickets por
 * día), para que "sobre qué día se soltó" y "en qué día se ve un ticket"
 * nunca diverjan.
 */
export function getCalendarDayDropId(dayKey: string): string {
  return `${DAY_DROP_ID_PREFIX}${dayKey}`;
}

function parseCalendarTicketDragId(id: string): string | null {
  if (!id.startsWith(TICKET_DRAG_ID_PREFIX)) {
    return null;
  }
  const ticketId = id.slice(TICKET_DRAG_ID_PREFIX.length);
  return ticketId.length > 0 ? ticketId : null;
}

function parseCalendarDayDropId(id: string): { year: number; month: number; day: number } | null {
  if (!id.startsWith(DAY_DROP_ID_PREFIX)) {
    return null;
  }

  const dayKey = id.slice(DAY_DROP_ID_PREFIX.length);
  const match = DAY_KEY_PATTERN.exec(dayKey);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  return {
    year: Number(yearText),
    month: Number(monthText) - 1,
    day: Number(dayText),
  };
}

export interface ResolveCalendarDropParams {
  /** id del elemento arrastrado (`event.active.id` de dnd-kit, como string). */
  activeId: string;
  /** id de la celda sobre la que se soltó (`event.over?.id ?? null`). */
  overId: string | null;
}

export interface CalendarDropResult {
  ticketId: string;
  dueDate: string;
}

/**
 * Resuelve el resultado de soltar un chip de ticket sobre una celda del
 * calendario mensual.
 *
 * Función PURA, sin dependencia de eventos reales de puntero/dnd-kit —
 * recibe solo los ids ya extraídos del evento — para poder testear "a qué
 * día se soltó" sin simular un drag real (mismo patrón que
 * `resolveDropOrder.ts` en el Kanban).
 *
 * Devuelve `null` si el drop no es válido: sin destino (`overId` nulo, se
 * soltó fuera de cualquier celda), o si alguno de los dos ids no tiene el
 * formato esperado.
 */
export function resolveCalendarDrop({
  activeId,
  overId,
}: ResolveCalendarDropParams): CalendarDropResult | null {
  if (!overId) {
    return null;
  }

  const ticketId = parseCalendarTicketDragId(activeId);
  if (!ticketId) {
    return null;
  }

  const dayInfo = parseCalendarDayDropId(overId);
  if (!dayInfo) {
    return null;
  }

  const dueDate = buildDueDateFromCalendarDay(dayInfo.year, dayInfo.month, dayInfo.day);
  return { ticketId, dueDate };
}
