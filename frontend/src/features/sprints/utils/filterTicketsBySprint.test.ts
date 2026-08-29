import { describe, expect, test } from "vitest";

import { filterTicketsBySprint } from "@/features/sprints/utils/filterTicketsBySprint";
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

describe("filterTicketsBySprint", () => {
  test("returns the exact same array reference for scope 'all'", () => {
    const tickets = [buildTicket({ id: "1" }), buildTicket({ id: "2", sprint_ids: ["sprint-1"] })];

    const result = filterTicketsBySprint(tickets, { kind: "all" });

    expect(result).toBe(tickets);
  });

  test("returns only tickets with no sprints for 'backlog'", () => {
    const backlogTicket = buildTicket({ id: "1", sprint_ids: [] });
    const tickets = [backlogTicket, buildTicket({ id: "2", sprint_ids: ["sprint-1"] })];

    const result = filterTicketsBySprint(tickets, { kind: "backlog" });

    expect(result).toEqual([backlogTicket]);
  });

  test("returns tickets of the given sprint, including ones carried over into several sprints", () => {
    const sprintTicket = buildTicket({ id: "1", sprint_ids: ["sprint-1"] });
    const carriedOver = buildTicket({ id: "4", sprint_ids: ["sprint-1", "sprint-2"] });
    const tickets = [
      sprintTicket,
      buildTicket({ id: "2", sprint_ids: ["sprint-2"] }),
      buildTicket({ id: "3", sprint_ids: [] }),
      carriedOver,
    ];

    const result = filterTicketsBySprint(tickets, { kind: "sprint", sprintId: "sprint-1" });

    expect(result).toEqual([sprintTicket, carriedOver]);
  });

  test("treats undefined sprint_ids as backlog", () => {
    const undefinedSprintTicket = buildTicket({ id: "1" });
    delete (undefinedSprintTicket as { sprint_ids?: string[] }).sprint_ids;
    const tickets = [undefinedSprintTicket, buildTicket({ id: "2", sprint_ids: ["sprint-1"] })];

    const result = filterTicketsBySprint(tickets, { kind: "backlog" });

    expect(result).toEqual([undefinedSprintTicket]);
  });

  test("returns an empty array for a sprint with no tickets", () => {
    const tickets = [buildTicket({ id: "1", sprint_ids: ["sprint-1"] })];

    const result = filterTicketsBySprint(tickets, { kind: "sprint", sprintId: "sprint-empty" });

    expect(result).toEqual([]);
  });
});
