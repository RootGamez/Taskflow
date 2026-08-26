/**
 * Utilidades puras de progreso de sprint. Fechas de sprint son `YYYY-MM-DD`
 * (DateField en el backend), nunca instantes (D25) -- se parsean con
 * `Date.UTC` y se comparan en dias enteros, nunca con el constructor local
 * de `Date`. `now` es inyectable (D10, ultimo parametro con default) para
 * tests deterministas independientes del huso horario del proceso. Mismo
 * patron ya resuelto en `features/calendar/utils/buildDueDateFromDay.ts`.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseUtcDateOnly(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Dias restantes hasta `endDate` (inclusive): `0` el mismo dia de fin,
 * negativo despues de vencido.
 */
export function daysRemaining(endDate: string, now: Date = new Date()): number {
  const endUtc = parseUtcDateOnly(endDate);
  const todayUtc = startOfUtcDay(now);
  return Math.round((endUtc - todayUtc) / MS_PER_DAY);
}

/**
 * Porcentaje de tickets completados, redondeado a entero y acotado a
 * [0, 100]. `total === 0` devuelve `0` explicito (sin division por cero).
 */
export function progressPercent(completed: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((completed / total) * 100));
}
