export function parseDueDateUtc(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDueDateDayMonth(value: string | null): string {
  if (!value) {
    return "-";
  }

  const dueDateUtc = parseDueDateUtc(value);
  if (!dueDateUtc) {
    return "-";
  }

  return `${pad2(dueDateUtc.getUTCDate())}/${pad2(dueDateUtc.getUTCMonth() + 1)}`;
}

export function isDueDateOverdue(value: string | null, now: Date = new Date()): boolean {
  if (!value) {
    return false;
  }

  const dueDateUtc = parseDueDateUtc(value);
  if (!dueDateUtc) {
    return false;
  }

  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueUtc = Date.UTC(
    dueDateUtc.getUTCFullYear(),
    dueDateUtc.getUTCMonth(),
    dueDateUtc.getUTCDate(),
  );

  return dueUtc < todayUtc;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface UtcDayRange {
  fromUtc: number;
  toUtc: number;
}

/**
 * Devuelve el rango de dias (timestamps UTC de medianoche, inclusive en
 * ambos extremos) para los presets relativos "today" | "week" | "month".
 * La semana empieza el lunes (consistente con el locale "es" usado en
 * TicketCalendarPicker.tsx).
 */
export function getUtcDayRange(
  preset: "today" | "week" | "month",
  now: Date = new Date(),
): UtcDayRange {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (preset === "today") {
    return { fromUtc: todayUtc, toUtc: todayUtc };
  }

  if (preset === "week") {
    const dayOfWeek = new Date(todayUtc).getUTCDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    return { fromUtc: todayUtc, toUtc: todayUtc + daysUntilSunday * MS_PER_DAY };
  }

  const endOfMonthUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0);
  return { fromUtc: todayUtc, toUtc: endOfMonthUtc };
}