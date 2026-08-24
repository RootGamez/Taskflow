import { describe, expect, test } from "vitest";

import { filterTicketsByDate } from "@/features/tickets/utils/filterTicketsByDate";
import type { TicketDateFilter } from "@/features/tickets/types/dateFilter.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

const NOW = new Date("2026-08-24T12:00:00.000Z"); // lunes

function buildTicket(overrides: Partial<Ticket> & { id: string }): Ticket {
  return {
    project_id: "project-1",
    column_id: "column-1",
    created_by: null,
    title: "Ticket",
    description: "",
    progress_notes: "",
    priority: "none",
    order: 1,
    due_date: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

function buildFilter(overrides: Partial<TicketDateFilter>): TicketDateFilter {
  return { preset: "all", from: null, to: null, ...overrides };
}

describe("filterTicketsByDate", () => {
  test("returns the exact same array reference for preset 'all'", () => {
    const tickets = [buildTicket({ id: "1" }), buildTicket({ id: "2" })];

    const result = filterTicketsByDate(tickets, buildFilter({ preset: "all" }), NOW);

    expect(result).toBe(tickets);
  });

  describe("preset 'overdue'", () => {
    test("excludes tickets without a due date", () => {
      const tickets = [buildTicket({ id: "1", due_date: null })];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "overdue" }), NOW);

      expect(result).toEqual([]);
    });

    test("excludes a ticket that is due today (boundary)", () => {
      const tickets = [buildTicket({ id: "1", due_date: "2026-08-24T00:00:00.000Z" })];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "overdue" }), NOW);

      expect(result).toEqual([]);
    });

    test("includes a ticket that was due yesterday", () => {
      const overdue = buildTicket({ id: "1", due_date: "2026-08-23T00:00:00.000Z" });
      const tickets = [overdue, buildTicket({ id: "2", due_date: "2026-08-25T00:00:00.000Z" })];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "overdue" }), NOW);

      expect(result).toEqual([overdue]);
    });
  });

  describe("preset 'today'", () => {
    test("includes only the ticket due today", () => {
      const dueToday = buildTicket({ id: "1", due_date: "2026-08-24T00:00:00.000Z" });
      const tickets = [
        dueToday,
        buildTicket({ id: "2", due_date: "2026-08-23T00:00:00.000Z" }),
        buildTicket({ id: "3", due_date: "2026-08-25T00:00:00.000Z" }),
        buildTicket({ id: "4", due_date: null }),
      ];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "today" }), NOW);

      expect(result).toEqual([dueToday]);
    });
  });

  describe("preset 'no_date'", () => {
    test("includes only tickets with a null due date", () => {
      const noDate = buildTicket({ id: "1", due_date: null });
      const tickets = [noDate, buildTicket({ id: "2", due_date: "2026-08-24T00:00:00.000Z" })];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "no_date" }), NOW);

      expect(result).toEqual([noDate]);
    });
  });

  describe("preset 'week'", () => {
    test("includes the last day of the current week (boundary, Sunday)", () => {
      const sunday = buildTicket({ id: "1", due_date: "2026-08-30T00:00:00.000Z" });
      const nextMonday = buildTicket({ id: "2", due_date: "2026-08-31T00:00:00.000Z" });
      const tickets = [sunday, nextMonday];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "week" }), NOW);

      expect(result).toEqual([sunday]);
    });

    test("excludes a ticket due before today", () => {
      const tickets = [buildTicket({ id: "1", due_date: "2026-08-23T00:00:00.000Z" })];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "week" }), NOW);

      expect(result).toEqual([]);
    });
  });

  describe("preset 'month'", () => {
    test("excludes the first day of the next month (boundary)", () => {
      const withinMonth = buildTicket({ id: "1", due_date: "2026-08-31T00:00:00.000Z" });
      const nextMonth = buildTicket({ id: "2", due_date: "2026-09-01T00:00:00.000Z" });
      const tickets = [withinMonth, nextMonth];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "month" }), NOW);

      expect(result).toEqual([withinMonth]);
    });
  });

  describe("preset 'custom'", () => {
    test("includes both boundaries (inclusive on both ends)", () => {
      const from = buildTicket({ id: "1", due_date: "2026-08-10T00:00:00.000Z" });
      const middle = buildTicket({ id: "2", due_date: "2026-08-15T00:00:00.000Z" });
      const to = buildTicket({ id: "3", due_date: "2026-08-20T00:00:00.000Z" });
      const outside = buildTicket({ id: "4", due_date: "2026-08-21T00:00:00.000Z" });
      const tickets = [from, middle, to, outside];

      const result = filterTicketsByDate(
        tickets,
        buildFilter({ preset: "custom", from: "2026-08-10", to: "2026-08-20" }),
        NOW,
      );

      expect(result).toEqual([from, middle, to]);
    });

    test("does not filter when both from and to are null", () => {
      const tickets = [buildTicket({ id: "1", due_date: null }), buildTicket({ id: "2", due_date: "2026-08-24T00:00:00.000Z" })];

      const result = filterTicketsByDate(tickets, buildFilter({ preset: "custom", from: null, to: null }), NOW);

      expect(result).toBe(tickets);
    });

    test("excludes tickets without a due date when a range is set", () => {
      const withDate = buildTicket({ id: "1", due_date: "2026-08-15T00:00:00.000Z" });
      const withoutDate = buildTicket({ id: "2", due_date: null });
      const tickets = [withDate, withoutDate];

      const result = filterTicketsByDate(
        tickets,
        buildFilter({ preset: "custom", from: "2026-08-10", to: "2026-08-20" }),
        NOW,
      );

      expect(result).toEqual([withDate]);
    });

    test("excludes a ticket with a malformed due_date when a range is set", () => {
      const tickets = [buildTicket({ id: "1", due_date: "not-a-real-date" })];

      const result = filterTicketsByDate(
        tickets,
        buildFilter({ preset: "custom", from: "2026-08-10", to: "2026-08-20" }),
        NOW,
      );

      expect(result).toEqual([]);
    });
  });

  test("returns an empty array when nothing matches", () => {
    const tickets = [buildTicket({ id: "1", due_date: "2026-01-01T00:00:00.000Z" })];

    const result = filterTicketsByDate(tickets, buildFilter({ preset: "today" }), NOW);

    expect(result).toEqual([]);
  });

  test("does not throw for a malformed due_date and excludes it from date-based presets", () => {
    const tickets = [buildTicket({ id: "1", due_date: "not-a-real-date" })];

    expect(() => filterTicketsByDate(tickets, buildFilter({ preset: "today" }), NOW)).not.toThrow();
    expect(filterTicketsByDate(tickets, buildFilter({ preset: "today" }), NOW)).toEqual([]);
  });
});
