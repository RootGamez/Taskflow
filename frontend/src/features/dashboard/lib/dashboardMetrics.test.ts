import { describe, expect, it } from "vitest";

import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import {
  countOpenTickets,
  countOverdueTickets,
  getDoneStatusIds,
  isTicketDone,
  summarizeProgress,
} from "@/features/dashboard/lib/dashboardMetrics";

function status(id: string, isDone: boolean): WorkspaceStatus {
  return {
    id,
    workspace_id: "w1",
    name: id,
    color: "#000",
    order: 0,
    is_done: isDone,
    is_system: false,
    created_at: "2026-08-01T00:00:00Z",
  };
}

const NOW = new Date("2026-08-29T12:00:00Z");

describe("dashboardMetrics", () => {
  it("getDoneStatusIds keeps only is_done statuses and tolerates undefined", () => {
    expect(getDoneStatusIds(undefined).size).toBe(0);
    const ids = getDoneStatusIds([status("todo", false), status("done", true)]);
    expect([...ids]).toEqual(["done"]);
  });

  it("isTicketDone is false when the ticket has no workspace_status_id", () => {
    const done = getDoneStatusIds([status("done", true)]);
    expect(isTicketDone({ workspace_status_id: null }, done)).toBe(false);
    expect(isTicketDone({ workspace_status_id: undefined }, done)).toBe(false);
    expect(isTicketDone({ workspace_status_id: "done" }, done)).toBe(true);
  });

  it("summarizeProgress computes completed/total/percent with no division by zero", () => {
    const done = getDoneStatusIds([status("done", true)]);
    expect(summarizeProgress([], done)).toEqual({ total: 0, completed: 0, percent: 0 });
    expect(
      summarizeProgress(
        [
          { workspace_status_id: "done" },
          { workspace_status_id: "done" },
          { workspace_status_id: "wip" },
          { workspace_status_id: null },
        ],
        done,
      ),
    ).toEqual({ total: 4, completed: 2, percent: 50 });
  });

  it("countOpenTickets excludes done tickets", () => {
    const done = getDoneStatusIds([status("done", true)]);
    const tickets = [
      { workspace_status_id: "done" },
      { workspace_status_id: "wip" },
      { workspace_status_id: null },
    ];
    expect(countOpenTickets(tickets, done)).toBe(2);
  });

  it("countOverdueTickets counts only open tickets past their due date", () => {
    const done = getDoneStatusIds([status("done", true)]);
    const tickets = [
      { workspace_status_id: "wip", due_date: "2026-08-01" }, // overdue, open
      { workspace_status_id: "done", due_date: "2026-08-01" }, // overdue but done
      { workspace_status_id: "wip", due_date: "2026-12-01" }, // future
      { workspace_status_id: "wip", due_date: null }, // no due date
    ];
    expect(countOverdueTickets(tickets, done, NOW)).toBe(1);
  });
});
