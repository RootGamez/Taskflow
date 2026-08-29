import { describe, expect, it } from "vitest";

import { formatWeekRange } from "@/features/goals/lib/weekRange";

describe("formatWeekRange", () => {
  it("formats a week within a single month as 'D – D MMM'", () => {
    // 2026-08-25 is a Monday.
    expect(formatWeekRange("2026-08-25")).toBe("25 – 31 AGO");
  });

  it("includes both months when the week crosses a month boundary", () => {
    // 2026-08-31 Monday -> Sunday 2026-09-06.
    expect(formatWeekRange("2026-08-31")).toBe("31 AGO – 6 SEP");
  });
});
