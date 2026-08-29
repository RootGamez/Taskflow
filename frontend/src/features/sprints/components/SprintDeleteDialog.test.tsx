import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SprintDeleteDialog } from "@/features/sprints/components/SprintDeleteDialog";
import type { Sprint } from "@/features/sprints/types/sprint.types";

function buildSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: "sprint-1",
    workspace_id: "project-1",
    name: "Sprint 1",
    goal: "",
    start_date: "2026-09-01",
    end_date: "2026-09-14",
    status: "planned",
    ticket_count: 0,
    completed_ticket_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SprintDeleteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when sprint is null", () => {
    const { container } = render(
      <SprintDeleteDialog sprint={null} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows how many tickets will return to the Backlog", () => {
    render(
      <SprintDeleteDialog sprint={buildSprint({ ticket_count: 4 })} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByText(/4 tickets volveran al Backlog/)).toBeInTheDocument();
  });

  it("uses singular phrasing for exactly one ticket", () => {
    render(
      <SprintDeleteDialog sprint={buildSprint({ ticket_count: 1 })} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByText(/1 ticket volvera al Backlog/)).toBeInTheDocument();
  });

  it("calls onConfirm when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SprintDeleteDialog sprint={buildSprint()} onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Eliminar sprint" }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onClose when 'Cancelar' is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SprintDeleteDialog sprint={buildSprint()} onClose={onClose} onConfirm={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
  });
});
