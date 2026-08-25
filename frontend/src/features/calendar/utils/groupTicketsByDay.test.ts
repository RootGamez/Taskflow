import { describe, expect, test } from "vitest";

import { formatCalendarDayKey, groupTicketsByDay } from "@/features/calendar/utils/groupTicketsByDay";
import type { Ticket } from "@/features/tickets/types/ticket.types";

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

describe("formatCalendarDayKey", () => {
  test("formats a UTC date as YYYY-MM-DD with zero padding", () => {
    expect(formatCalendarDayKey(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01-05");
  });
});

describe("groupTicketsByDay", () => {
  test("groups tickets by their due_date UTC day", () => {
    const ticketA = buildTicket({ id: "a", due_date: "2026-08-24T10:00:00.000Z" });
    const ticketB = buildTicket({ id: "b", due_date: "2026-08-24T23:00:00.000Z" });
    const ticketC = buildTicket({ id: "c", due_date: "2026-08-25T00:00:00.000Z" });

    const grouped = groupTicketsByDay([ticketA, ticketB, ticketC]);

    expect(grouped.get("2026-08-24")).toEqual([ticketA, ticketB]);
    expect(grouped.get("2026-08-25")).toEqual([ticketC]);
  });

  test("does not include a ticket with a null due_date in any day", () => {
    const ticketWithoutDueDate = buildTicket({ id: "no-date", due_date: null });
    const ticketWithDueDate = buildTicket({ id: "has-date", due_date: "2026-08-24T00:00:00.000Z" });

    const grouped = groupTicketsByDay([ticketWithoutDueDate, ticketWithDueDate]);

    const allGroupedTickets = Array.from(grouped.values()).flat();
    expect(allGroupedTickets).toEqual([ticketWithDueDate]);
    expect(allGroupedTickets.some((ticket) => ticket.id === "no-date")).toBe(false);
  });

  test("does not throw for a malformed due_date and simply omits that ticket", () => {
    const ticketWithMalformedDate = buildTicket({ id: "malformed", due_date: "not-a-date" });

    expect(() => groupTicketsByDay([ticketWithMalformedDate])).not.toThrow();
    const grouped = groupTicketsByDay([ticketWithMalformedDate]);
    expect(Array.from(grouped.values()).flat()).toHaveLength(0);
  });

  test("returns an empty map for an empty ticket list", () => {
    const grouped = groupTicketsByDay([]);
    expect(grouped.size).toBe(0);
  });
});
