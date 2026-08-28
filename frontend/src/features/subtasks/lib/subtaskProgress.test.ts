import { describe, expect, test } from "vitest";

import { subtaskProgress } from "@/features/subtasks/lib/subtaskProgress";

describe("subtaskProgress", () => {
  test("percent is 0 when total is 0 (no division by zero)", () => {
    expect(subtaskProgress({ done: 0, total: 0 }).percent).toBe(0);
  });

  test("percent rounds to an integer", () => {
    expect(subtaskProgress({ done: 1, total: 3 }).percent).toBe(33);
  });

  test("percent is capped at 100 when done > total", () => {
    expect(subtaskProgress({ done: 9, total: 7 }).percent).toBe(100);
  });

  test('label reads "3/7"', () => {
    expect(subtaskProgress({ done: 3, total: 7 }).label).toBe("3/7");
  });
});
