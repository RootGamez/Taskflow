/**
 * Construye un `due_date` ISO (string, UTC) a partir de un día de calendario
 * (año, mes 0-indexado, día del mes).
 *
 * A propósito usa MEDIODÍA UTC, no medianoche: con medianoche, una lectura
 * posterior en un huso horario corrido puede mostrar el día equivocado. Esta
 * es la mitigación concreta de un riesgo de timezone ya identificado en el
 * plan (ver `buildDueDateFromDay.test.ts`, que corre el mismo caso bajo
 * `TZ=Pacific/Kiritimati` y `TZ=Pacific/Midway`).
 *
 * Usa exclusivamente `Date.UTC` — nunca el constructor local de `Date` — así
 * el resultado es 100% independiente del huso horario del proceso que
 * ejecuta este código.
 */
export function buildDueDateFromCalendarDay(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day, 12, 0, 0)).toISOString();
}
