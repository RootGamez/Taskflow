import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SprintSummaryCard } from "@/features/sprints/components/SprintSummaryCard";
import type { Sprint } from "@/features/sprints/types/sprint.types";

function buildSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: "sprint-1",
    project_id: "project-1",
    name: "Sprint 12",
    goal: "Cerrar el flujo de onboarding",
    start_date: "2026-09-01",
    end_date: "2026-09-14",
    status: "active",
    ticket_count: 14,
    completed_ticket_count: 6,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SprintSummaryCard", () => {
  it("renders nothing when there is no active sprint", () => {
    const { container } = render(<SprintSummaryCard sprint={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders "6/14 completados"', () => {
    render(<SprintSummaryCard sprint={buildSprint()} now={new Date("2026-09-10T00:00:00Z")} />);

    expect(screen.getByText("6/14 completados")).toBeInTheDocument();
  });

  it("renders the sprint name and goal", () => {
    render(<SprintSummaryCard sprint={buildSprint()} now={new Date("2026-09-10T00:00:00Z")} />);

    expect(screen.getByText("Sprint 12")).toBeInTheDocument();
    expect(screen.getByText("· Cerrar el flujo de onboarding")).toBeInTheDocument();
  });

  it("renders an overdue message when end_date is in the past", () => {
    render(
      <SprintSummaryCard
        sprint={buildSprint({ end_date: "2026-09-01" })}
        now={new Date("2026-09-05T00:00:00Z")}
      />,
    );

    expect(screen.getByText("Finalizo hace 4 dias")).toBeInTheDocument();
  });

  it("renders the days remaining when the sprint has not finished", () => {
    render(<SprintSummaryCard sprint={buildSprint()} now={new Date("2026-09-10T00:00:00Z")} />);

    expect(screen.getByText("4 dias restantes")).toBeInTheDocument();
  });
});
