import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { CalendarGrid } from "@/features/calendar/components/CalendarGrid";
import type { Ticket } from "@/features/tickets/types/ticket.types";

function buildTicket(overrides: Partial<Ticket> & { id: string }): Ticket {
  return {
    project_id: "project-1",
    column_id: "column-1",
    created_by: null,
    title: `Ticket ${overrides.id}`,
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

// Lunes 24 de agosto de 2026 — fecha fija para tests deterministas.
const FIXED_NOW = new Date("2026-08-24T12:00:00.000Z");

describe("CalendarGrid", () => {
  test("renders the current month/year label and places a ticket on its due-date cell", () => {
    const ticket = buildTicket({ id: "a", due_date: "2026-08-25T00:00:00.000Z" });

    render(
      <CalendarGrid tickets={[ticket]} canMutate onOpenTicket={vi.fn()} onDropTicket={vi.fn()} now={FIXED_NOW} />,
    );

    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
    expect(screen.getByText("Ticket a")).toBeInTheDocument();
  });

  test("renders exactly 42 day cells (6 complete weeks)", () => {
    render(<CalendarGrid tickets={[]} canMutate onOpenTicket={vi.fn()} onDropTicket={vi.fn()} now={FIXED_NOW} />);

    expect(screen.getAllByTestId(/^calendar-day-cell-/)).toHaveLength(42);
  });

  test("navigating to the next month updates the header label", async () => {
    const user = userEvent.setup();
    render(<CalendarGrid tickets={[]} canMutate onOpenTicket={vi.fn()} onDropTicket={vi.fn()} now={FIXED_NOW} />);

    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));

    expect(screen.getByText("Septiembre 2026")).toBeInTheDocument();
  });

  test("navigating to the previous month updates the header label", async () => {
    const user = userEvent.setup();
    render(<CalendarGrid tickets={[]} canMutate onOpenTicket={vi.fn()} onDropTicket={vi.fn()} now={FIXED_NOW} />);

    await user.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(screen.getByText("Julio 2026")).toBeInTheDocument();
  });

  test("navigating across a year boundary updates both month and year", async () => {
    const user = userEvent.setup();
    const december = new Date("2026-12-15T12:00:00.000Z");
    render(<CalendarGrid tickets={[]} canMutate onOpenTicket={vi.fn()} onDropTicket={vi.fn()} now={december} />);

    expect(screen.getByText("Diciembre 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));

    expect(screen.getByText("Enero 2027")).toBeInTheDocument();
  });

  test("clicking 'Hoy' after navigating away returns to the current month", async () => {
    const user = userEvent.setup();
    render(<CalendarGrid tickets={[]} canMutate onOpenTicket={vi.fn()} onDropTicket={vi.fn()} now={FIXED_NOW} />);

    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    expect(screen.getByText("Octubre 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hoy" }));

    expect(screen.getByText("Agosto 2026")).toBeInTheDocument();
  });

  test("clicking a rendered ticket chip calls onOpenTicket with that ticket", async () => {
    const user = userEvent.setup();
    const ticket = buildTicket({ id: "a", due_date: "2026-08-25T00:00:00.000Z" });
    const onOpenTicket = vi.fn();

    render(
      <CalendarGrid
        tickets={[ticket]}
        canMutate
        onOpenTicket={onOpenTicket}
        onDropTicket={vi.fn()}
        now={FIXED_NOW}
      />,
    );

    await user.click(screen.getByText("Ticket a"));

    expect(onOpenTicket).toHaveBeenCalledWith(ticket);
  });
});
