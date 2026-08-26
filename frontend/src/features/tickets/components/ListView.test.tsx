import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListView } from "@/features/tickets/components/ListView";
import type { Label, Ticket } from "@/features/tickets/types/ticket.types";

function buildLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    project_id: "project-1",
    name: "Bug",
    color: "#DC2626",
    ...overrides,
  };
}

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-1",
    project_id: "project-1",
    column_id: "column-1",
    created_by: "user-1",
    title: "Arreglar el bug de login",
    description: "",
    progress_notes: "",
    priority: "medium",
    order: 0,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

describe("ListView", () => {
  it("renderiza una columna Ref con la referencia", () => {
    const ticket = buildTicket({ reference: "TASK-142" });

    render(<ListView tickets={[ticket]} />);

    expect(screen.getByText("Ref")).toBeInTheDocument();
    expect(screen.getByText("TASK-142")).toBeInTheDocument();
  });

  it("renderiza un guion cuando reference es null", () => {
    const ticket = buildTicket({ reference: null });

    render(<ListView tickets={[ticket]} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renderiza los chips de labels en la columna de labels", () => {
    const ticket = buildTicket({
      labels: [buildLabel({ id: "l1", name: "Bug" }), buildLabel({ id: "l2", name: "Feature" })],
    });

    render(<ListView tickets={[ticket]} />);

    expect(screen.getByText("Bug")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();
  });

  it("llama a onOpenTicket cuando se hace click en una fila", () => {
    const onOpenTicket = vi.fn();
    const ticket = buildTicket();

    render(<ListView tickets={[ticket]} onOpenTicket={onOpenTicket} />);

    fireEvent.click(screen.getByText("Arreglar el bug de login"));

    expect(onOpenTicket).toHaveBeenCalledWith(ticket);
  });
});
