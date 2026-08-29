import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/**
 * "25 – 31 AGO" a partir del lunes ISO (YYYY-MM-DD). Si el rango cruza de mes
 * incluye ambos: "28 AGO – 3 SEP".
 */
export function formatWeekRange(weekStartIso: string): string {
  const start = parseISO(weekStartIso);
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();

  const startLabel = sameMonth
    ? format(start, "d", { locale: es })
    : format(start, "d MMM", { locale: es });
  const endLabel = format(end, "d MMM", { locale: es });

  return `${startLabel} – ${endLabel}`.toUpperCase();
}
