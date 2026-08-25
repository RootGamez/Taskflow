import { afterEach, describe, expect, test } from "vitest";

import { buildDueDateFromCalendarDay } from "@/features/calendar/utils/buildDueDateFromDay";
import { parseDueDateUtc } from "@/features/tickets/utils/dueDate";

const ORIGINAL_TZ = process.env.TZ;

describe("buildDueDateFromCalendarDay", () => {
  afterEach(() => {
    // `process.env.TZ = undefined` en vez de `delete` para que quede en el
    // mismo estado en que Vitest lo tenía antes de este archivo.
    process.env.TZ = ORIGINAL_TZ;
  });

  test.each([
    ["Pacific/Kiritimati", "UTC+14"],
    ["Pacific/Midway", "UTC-11"],
  ])("returns noon UTC on the requested day regardless of process TZ (%s / %s)", (tz) => {
    process.env.TZ = tz;

    const result = buildDueDateFromCalendarDay(2026, 7, 25); // 25 de agosto de 2026

    expect(result).toBe("2026-08-25T12:00:00.000Z");

    // Confirma además que, al reinterpretar el resultado con la MISMA
    // utilidad UTC que ya usa el resto de la app (parseDueDateUtc), el día
    // calendario sigue siendo el 25 de agosto — no depende de leer el
    // resultado con getters locales.
    const parsedBackUtc = parseDueDateUtc(result);
    expect(parsedBackUtc?.getUTCFullYear()).toBe(2026);
    expect(parsedBackUtc?.getUTCMonth()).toBe(7);
    expect(parsedBackUtc?.getUTCDate()).toBe(25);
  });

  test("produces the identical ISO string for the same input across extreme timezones (TZ-independence regression guard)", () => {
    process.env.TZ = "Pacific/Kiritimati";
    const resultInKiritimati = buildDueDateFromCalendarDay(2026, 7, 25);

    process.env.TZ = "Pacific/Midway";
    const resultInMidway = buildDueDateFromCalendarDay(2026, 7, 25);

    // Si la implementación usara el constructor local de Date en vez de
    // Date.UTC, este test fallaría: el mismo (year, month, day) produciría
    // instantes UTC distintos según el TZ del proceso.
    expect(resultInKiritimati).toBe(resultInMidway);
  });

  test("handles the first day of the month and the last day of a leap February", () => {
    expect(buildDueDateFromCalendarDay(2026, 0, 1)).toBe("2026-01-01T12:00:00.000Z");
    expect(buildDueDateFromCalendarDay(2028, 1, 29)).toBe("2028-02-29T12:00:00.000Z");
  });
});
