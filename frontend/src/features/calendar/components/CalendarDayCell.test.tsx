import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { describe, expect, test, vi } from "vitest";

import { CalendarDayCell } from "@/features/calendar/components/CalendarDayCell";
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

interface RenderOverrides {
  isCurrentMonth?: boolean;
  isToday?: boolean;
  canMutate?: boolean;
}

function DndWrapper({ children }: PropsWithChildren) {
  // Misma activationConstraint que CalendarGrid en producción: sin ella, el
  // sensor por defecto de dnd-kit puede tragarse el evento de click de un
  // `userEvent.click` (pointerdown+pointerup sin movimiento) al iniciar un
  // drag antes de que el navegador dispare el "click" sintético.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  return <DndContext sensors={sensors}>{children}</DndContext>;
}

function renderCell(tickets: Ticket[], overrides: RenderOverrides = {}) {
  const onOpenTicket = vi.fn();
  render(
    <DndWrapper>
      <CalendarDayCell
        date={new Date(Date.UTC(2026, 7, 25))}
        isCurrentMonth={overrides.isCurrentMonth ?? true}
        isToday={overrides.isToday ?? false}
        tickets={tickets}
        canMutate={overrides.canMutate ?? true}
        onOpenTicket={onOpenTicket}
      />
    </DndWrapper>,
  );
  return { onOpenTicket };
}

describe("CalendarDayCell", () => {
  test("renders the day-of-month number", () => {
    renderCell([]);
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  test("renders up to 3 ticket chips without an overflow indicator", () => {
    const tickets = [buildTicket({ id: "a" }), buildTicket({ id: "b" }), buildTicket({ id: "c" })];
    renderCell(tickets);

    expect(screen.getByText("Ticket a")).toBeInTheDocument();
    expect(screen.getByText("Ticket b")).toBeInTheDocument();
    expect(screen.getByText("Ticket c")).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+ más$/)).not.toBeInTheDocument();
  });

  test("shows '+N más' when there are more than 3 tickets in a single day", () => {
    const tickets = [
      buildTicket({ id: "a" }),
      buildTicket({ id: "b" }),
      buildTicket({ id: "c" }),
      buildTicket({ id: "d" }),
      buildTicket({ id: "e" }),
    ];
    renderCell(tickets);

    expect(screen.getByText("Ticket a")).toBeInTheDocument();
    expect(screen.getByText("Ticket b")).toBeInTheDocument();
    expect(screen.getByText("Ticket c")).toBeInTheDocument();
    expect(screen.queryByText("Ticket d")).not.toBeInTheDocument();
    expect(screen.queryByText("Ticket e")).not.toBeInTheDocument();
    expect(screen.getByText("+2 más")).toBeInTheDocument();
  });

  test("clicking a ticket chip calls onOpenTicket with that ticket", async () => {
    const user = userEvent.setup();
    const ticket = buildTicket({ id: "a" });
    const { onOpenTicket } = renderCell([ticket]);

    await user.click(screen.getByText("Ticket a"));

    expect(onOpenTicket).toHaveBeenCalledWith(ticket);
  });

  test("renders an overdue ticket with the urgent priority tone", () => {
    const overdueTicket = buildTicket({ id: "overdue", due_date: "2020-01-01T00:00:00.000Z" });
    renderCell([overdueTicket]);

    expect(screen.getByText("Ticket overdue")).toHaveClass("bg-priority-urgent-bg", "text-priority-urgent");
  });

  test("renders a future ticket with the neutral tone", () => {
    const futureTicket = buildTicket({ id: "future", due_date: "2099-01-01T00:00:00.000Z" });
    renderCell([futureTicket]);

    expect(screen.getByText("Ticket future")).toHaveClass("bg-muted", "text-foreground");
  });

  test("renders chips as non-draggable (cursor-pointer) when canMutate is false", () => {
    const ticket = buildTicket({ id: "readonly" });
    renderCell([ticket], { canMutate: false });

    expect(screen.getByText("Ticket readonly")).toHaveClass("cursor-pointer");
    expect(screen.getByText("Ticket readonly")).not.toHaveClass("cursor-grab");
  });
});
