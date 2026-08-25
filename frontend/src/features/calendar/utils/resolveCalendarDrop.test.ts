import { describe, expect, test } from "vitest";

import {
  getCalendarDayDropId,
  getCalendarTicketDragId,
  resolveCalendarDrop,
} from "@/features/calendar/utils/resolveCalendarDrop";

describe("resolveCalendarDrop", () => {
  test("returns the ticketId and the noon-UTC dueDate for a valid drop", () => {
    const result = resolveCalendarDrop({
      activeId: getCalendarTicketDragId("ticket-1"),
      overId: getCalendarDayDropId("2026-08-25"),
    });

    expect(result).toEqual({ ticketId: "ticket-1", dueDate: "2026-08-25T12:00:00.000Z" });
  });

  test("returns null when dropped outside any valid cell (overId is null)", () => {
    const result = resolveCalendarDrop({
      activeId: getCalendarTicketDragId("ticket-1"),
      overId: null,
    });

    expect(result).toBeNull();
  });

  test("returns null when the active id is not a calendar ticket drag id", () => {
    const result = resolveCalendarDrop({
      activeId: "something-else::ticket-1",
      overId: getCalendarDayDropId("2026-08-25"),
    });

    expect(result).toBeNull();
  });

  test("returns null when the over id is not a calendar day drop id", () => {
    const result = resolveCalendarDrop({
      activeId: getCalendarTicketDragId("ticket-1"),
      overId: "something-else::2026-08-25",
    });

    expect(result).toBeNull();
  });

  test("returns null when the day key inside the drop id is malformed", () => {
    const result = resolveCalendarDrop({
      activeId: getCalendarTicketDragId("ticket-1"),
      overId: "calendar-day::not-a-date",
    });

    expect(result).toBeNull();
  });

  test("builds correct drag/drop ids round-trip for a ticket id containing special characters", () => {
    const ticketId = "ticket-uuid-1234-abcd";
    const result = resolveCalendarDrop({
      activeId: getCalendarTicketDragId(ticketId),
      overId: getCalendarDayDropId("2028-02-29"),
    });

    expect(result).toEqual({ ticketId, dueDate: "2028-02-29T12:00:00.000Z" });
  });
});
