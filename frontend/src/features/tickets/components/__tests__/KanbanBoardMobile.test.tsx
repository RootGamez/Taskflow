import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KanbanBoardMobile } from "@/features/tickets/components/KanbanBoardMobile";
import type { Column } from "@/features/projects/types/project.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

const columns: Column[] = [
  { id: "col-todo", name: "Por hacer", color: "#a1a1aa", order: 0 },
  { id: "col-doing", name: "En progreso", color: "#3b82f6", order: 1 },
  { id: "col-done", name: "Hecho", color: "#10b981", order: 2 },
] as unknown as Column[];

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t1",
    project_id: "p1",
    column_id: "col-todo",
    created_by: "u1",
    title: "Ticket uno",
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

function renderBoard(props: Partial<React.ComponentProps<typeof KanbanBoardMobile>> = {}) {
  const tickets = props.tickets ?? [
    buildTicket({ id: "t1", title: "Login roto", column_id: "col-todo", order: 1 }),
    buildTicket({ id: "t2", title: "Rate limit", column_id: "col-doing", order: 1 }),
  ];
  const onMoveTicket = props.onMoveTicket ?? vi.fn();
  const onCreateTicket = props.onCreateTicket ?? vi.fn();
  const onOpenTicket = props.onOpenTicket ?? vi.fn();
  render(
    <KanbanBoardMobile
      columns={columns}
      tickets={tickets}
      allTickets={tickets}
      canMutate
      onOpenTicket={onOpenTicket}
      onCreateTicket={onCreateTicket}
      onMoveTicket={onMoveTicket}
      {...props}
    />,
  );
  return { onMoveTicket, onCreateTicket, onOpenTicket };
}

describe("KanbanBoardMobile", () => {
  it("muestra solo los tickets de la columna activa y cambia al tocar otro chip", () => {
    renderBoard();

    expect(screen.getByText("Login roto")).toBeInTheDocument();
    expect(screen.queryByText("Rate limit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /En progreso/ }));

    expect(screen.getByText("Rate limit")).toBeInTheDocument();
    expect(screen.queryByText("Login roto")).not.toBeInTheDocument();
  });

  it("mueve un ticket a otra columna desde la hoja 'Mover a…'", async () => {
    const { onMoveTicket } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /Mover Login roto a otra columna/ }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Hecho/ }));

    expect(onMoveTicket).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: "t1", fromColumnId: "col-todo", toColumnId: "col-done" }),
    );
  });

  it("el botón de crear tarea usa la columna activa", () => {
    const { onCreateTicket } = renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /Crear tarea en Por hacer/ }));

    expect(onCreateTicket).toHaveBeenCalledWith("col-todo");
  });

  it("muestra un estado vacío cuando la columna activa no tiene tickets", () => {
    renderBoard({ tickets: [buildTicket({ column_id: "col-doing" })] });

    expect(screen.getByText(/No hay tickets en esta columna/)).toBeInTheDocument();
  });
});
