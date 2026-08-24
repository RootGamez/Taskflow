function parseDueDateUtc(value: string): Date | null {
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

export function isDueDateOverdue(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const dueDateUtc = parseDueDateUtc(value);
  if (!dueDateUtc) {
    return false;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueUtc = Date.UTC(
    dueDateUtc.getUTCFullYear(),
    dueDateUtc.getUTCMonth(),
    dueDateUtc.getUTCDate(),
  );

  return dueUtc < todayUtc;
}