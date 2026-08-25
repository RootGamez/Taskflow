const DAYS_PER_WEEK = 7;
const WEEKS_IN_GRID = 6;
const DAYS_IN_GRID = DAYS_PER_WEEK * WEEKS_IN_GRID;

/**
 * Convierte el día de la semana de JS (0=domingo..6=sábado) en el offset de
 * días hacia atrás hasta el lunes de esa semana. Consistente con
 * `getUtcDayRange` en `features/tickets/utils/dueDate.ts`, que ya asume
 * semana lunes-domingo.
 */
function getOffsetToMonday(jsWeekday: number): number {
  return (jsWeekday + 6) % 7;
}

/**
 * Construye la grilla mensual del calendario: siempre 6 semanas de 7 días
 * (lunes primero), incluyendo días del mes anterior/siguiente para completar
 * la grilla. Todas las fechas son medianoche UTC — quien consuma el
 * resultado puede saber si un día pertenece al mes actual comparando
 * `date.getUTCMonth()` contra el `month` pedido, sin necesidad de un campo
 * adicional.
 */
export function buildMonthGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const offsetToMonday = getOffsetToMonday(firstOfMonth.getUTCDay());
  const gridStartDay = 1 - offsetToMonday;

  const days: Date[] = [];
  for (let index = 0; index < DAYS_IN_GRID; index += 1) {
    days.push(new Date(Date.UTC(year, month, gridStartDay + index)));
  }

  const weeks: Date[][] = [];
  for (let weekIndex = 0; weekIndex < WEEKS_IN_GRID; weekIndex += 1) {
    const start = weekIndex * DAYS_PER_WEEK;
    weeks.push(days.slice(start, start + DAYS_PER_WEEK));
  }

  return weeks;
}
