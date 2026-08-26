import { afterEach, describe, expect, test } from "vitest";

import { daysRemaining, progressPercent } from "@/features/sprints/utils/sprintProgress";

const ORIGINAL_TZ = process.env.TZ;

describe("daysRemaining", () => {
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  test("is 0 on the end date", () => {
    const now = new Date("2026-09-14T15:00:00.000Z");

    expect(daysRemaining("2026-09-14", now)).toBe(0);
  });

  test("is negative after the end date", () => {
    const now = new Date("2026-09-20T00:00:00.000Z");

    expect(daysRemaining("2026-09-14", now)).toBe(-6);
  });

  test("is positive before the end date", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");

    expect(daysRemaining("2026-09-14", now)).toBe(4);
  });

  test.each([
    ["Pacific/Kiritimati", "UTC+14"],
    ["Pacific/Midway", "UTC-11"],
  ])("is stable at %s (%s)", (tz) => {
    process.env.TZ = tz;
    const now = new Date("2026-09-10T00:00:00.000Z");

    expect(daysRemaining("2026-09-14", now)).toBe(4);
  });
});

describe("progressPercent", () => {
  test("is 0 when total is 0 (no division by zero)", () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  test("rounds to the nearest integer", () => {
    expect(progressPercent(1, 3)).toBe(33);
  });

  test("is capped at 100", () => {
    expect(progressPercent(14, 10)).toBe(100);
  });

  test("is 0 when nothing is completed", () => {
    expect(progressPercent(0, 10)).toBe(0);
  });
});
