import { afterEach, describe, expect, test } from "vitest";

import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";

const INITIAL_STATE = { preset: "all" as const, from: null, to: null };

afterEach(() => {
  useTicketFilterStore.setState({ dateFilter: INITIAL_STATE });
});

describe("useTicketFilterStore", () => {
  test("starts with preset 'all' and no custom range", () => {
    expect(useTicketFilterStore.getState().dateFilter).toEqual(INITIAL_STATE);
  });

  test("setPreset updates the preset", () => {
    useTicketFilterStore.getState().setPreset("overdue");

    expect(useTicketFilterStore.getState().dateFilter.preset).toBe("overdue");
  });

  test("setPreset clears any previous custom range", () => {
    useTicketFilterStore.getState().setCustomRange("2026-08-01", "2026-08-10");

    useTicketFilterStore.getState().setPreset("today");

    expect(useTicketFilterStore.getState().dateFilter).toEqual({
      preset: "today",
      from: null,
      to: null,
    });
  });

  test("setCustomRange sets preset to 'custom' and stores the range", () => {
    useTicketFilterStore.getState().setCustomRange("2026-08-01", "2026-08-10");

    expect(useTicketFilterStore.getState().dateFilter).toEqual({
      preset: "custom",
      from: "2026-08-01",
      to: "2026-08-10",
    });
  });

  test("clear resets to the initial state", () => {
    useTicketFilterStore.getState().setCustomRange("2026-08-01", "2026-08-10");

    useTicketFilterStore.getState().clear();

    expect(useTicketFilterStore.getState().dateFilter).toEqual(INITIAL_STATE);
  });
});
