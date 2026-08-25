import { describe, expect, test } from "vitest";

import { buildMonthGrid } from "@/features/calendar/utils/buildMonthGrid";

describe("buildMonthGrid", () => {
  test("always returns exactly 6 weeks of 7 days", () => {
    const grid = buildMonthGrid(2026, 7); // agosto 2026, arranca sábado

    expect(grid).toHaveLength(6);
    for (const week of grid) {
      expect(week).toHaveLength(7);
    }
  });

  test("every week starts on Monday and ends on Sunday", () => {
    const grid = buildMonthGrid(2026, 7);

    for (const week of grid) {
      expect(week[0].getUTCDay()).toBe(1); // lunes
      expect(week[6].getUTCDay()).toBe(0); // domingo
    }
  });

  test("includes leading days from the previous month when the month starts on Sunday", () => {
    // Febrero 2026 arranca domingo 1/2. El lunes anterior es 26/1.
    const grid = buildMonthGrid(2026, 1);

    const firstDay = grid[0][0];
    expect(firstDay.getUTCFullYear()).toBe(2026);
    expect(firstDay.getUTCMonth()).toBe(0); // enero
    expect(firstDay.getUTCDate()).toBe(26);

    const firstOfFebruary = grid[0][6];
    expect(firstOfFebruary.getUTCMonth()).toBe(1);
    expect(firstOfFebruary.getUTCDate()).toBe(1);
  });

  test("handles February in a leap year (29 days), starting on Tuesday", () => {
    // Febrero 2028 es bisiesto (29 días) y arranca martes 1/2.
    // El lunes de esa semana es el 31/1.
    const grid = buildMonthGrid(2028, 1);

    const firstDay = grid[0][0];
    expect(firstDay.getUTCFullYear()).toBe(2028);
    expect(firstDay.getUTCMonth()).toBe(0); // enero
    expect(firstDay.getUTCDate()).toBe(31);

    const allDates = grid.flat();
    const leapDay = allDates.find(
      (date) => date.getUTCMonth() === 1 && date.getUTCDate() === 29,
    );
    expect(leapDay).toBeDefined();

    const currentMonthDays = allDates.filter((date) => date.getUTCMonth() === 1);
    expect(currentMonthDays).toHaveLength(29);
  });

  test("includes trailing days from the next month to complete the 6-week grid", () => {
    const grid = buildMonthGrid(2026, 7); // agosto 2026, 31 días, arranca sábado
    const allDates = grid.flat();

    const lastDay = allDates[allDates.length - 1];
    expect(lastDay.getUTCMonth()).toBe(8); // septiembre
  });

  test("all 42 cells are chronologically consecutive days", () => {
    const grid = buildMonthGrid(2026, 7);
    const allDates = grid.flat();

    for (let index = 1; index < allDates.length; index += 1) {
      const diffMs = allDates[index].getTime() - allDates[index - 1].getTime();
      expect(diffMs).toBe(24 * 60 * 60 * 1000);
    }
  });
});
