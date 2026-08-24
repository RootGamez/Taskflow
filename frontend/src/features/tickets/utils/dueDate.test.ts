import { describe, expect, test } from "vitest";

import { formatDueDateDayMonth, getUtcDayRange, isDueDateOverdue } from "@/features/tickets/utils/dueDate";

describe("formatDueDateDayMonth", () => {
  test("returns '-' for null input", () => {
    expect(formatDueDateDayMonth(null)).toBe("-");
  });

  test("returns '-' for a malformed date string", () => {
    expect(formatDueDateDayMonth("not-a-date")).toBe("-");
  });

  test("formats using UTC, not local time, for a timestamp close to local midnight", () => {
    // 2026-01-01T23:30:00Z es 2026-01-02 en zonas horarias adelantadas a UTC,
    // pero debe formatearse como 01/01 porque se interpreta en UTC.
    expect(formatDueDateDayMonth("2026-01-01T23:30:00.000Z")).toBe("01/01");
  });

  test("formats a plain YYYY-MM-DD date as day/month", () => {
    expect(formatDueDateDayMonth("2026-08-24")).toBe("24/08");
  });
});

describe("isDueDateOverdue", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");

  test("returns false for a due date that is today", () => {
    expect(isDueDateOverdue("2026-08-24T00:00:00.000Z", now)).toBe(false);
  });

  test("returns true for a due date that was yesterday", () => {
    expect(isDueDateOverdue("2026-08-23T00:00:00.000Z", now)).toBe(true);
  });

  test("returns false for a due date in the future", () => {
    expect(isDueDateOverdue("2026-08-25T00:00:00.000Z", now)).toBe(false);
  });

  test("returns false for null", () => {
    expect(isDueDateOverdue(null, now)).toBe(false);
  });

  test("returns false for a malformed date string", () => {
    expect(isDueDateOverdue("not-a-date", now)).toBe(false);
  });
});

describe("getUtcDayRange", () => {
  test("'today' returns the same UTC day as from and to", () => {
    const now = new Date("2026-08-24T12:00:00.000Z"); // lunes
    const range = getUtcDayRange("today", now);
    expect(range.fromUtc).toBe(Date.UTC(2026, 7, 24));
    expect(range.toUtc).toBe(Date.UTC(2026, 7, 24));
  });

  test("'week' ends on Sunday when today is Monday", () => {
    const now = new Date("2026-08-24T12:00:00.000Z"); // lunes
    const range = getUtcDayRange("week", now);
    expect(range.fromUtc).toBe(Date.UTC(2026, 7, 24));
    expect(range.toUtc).toBe(Date.UTC(2026, 7, 30)); // domingo
  });

  test("'week' ends today when today is already Sunday", () => {
    const now = new Date("2026-08-30T12:00:00.000Z"); // domingo
    const range = getUtcDayRange("week", now);
    expect(range.fromUtc).toBe(Date.UTC(2026, 7, 30));
    expect(range.toUtc).toBe(Date.UTC(2026, 7, 30));
  });

  test("'month' ends on the last day of the current month", () => {
    const now = new Date("2026-08-24T12:00:00.000Z");
    const range = getUtcDayRange("month", now);
    expect(range.fromUtc).toBe(Date.UTC(2026, 7, 24));
    expect(range.toUtc).toBe(Date.UTC(2026, 7, 31));
  });

  test("'month' handles February in a leap year correctly", () => {
    const now = new Date("2028-02-10T12:00:00.000Z");
    const range = getUtcDayRange("month", now);
    expect(range.toUtc).toBe(Date.UTC(2028, 1, 29));
  });
});
