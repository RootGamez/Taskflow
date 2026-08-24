import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TicketCard } from "@/features/tickets/components/TicketCard";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import type { User } from "@/features/auth/types/auth.types";

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "user@example.com",
    full_name: "Ana Perez",
    avatar_url: null,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
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
    priority: "urgent",
    order: 0,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

describe("TicketCard", () => {
  it("muestra el label de prioridad en espanol", () => {
    const ticket = buildTicket({ priority: "urgent" });

    render(<TicketCard ticket={ticket} onOpen={vi.fn()} />);

    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it.each([
    ["high", "Alta"],
    ["medium", "Media"],
    ["low", "Baja"],
    ["none", "Sin prioridad"],
  ] as const)("muestra '%s' -> '%s'", (priority, label) => {
    const ticket = buildTicket({ priority });

    render(<TicketCard ticket={ticket} onOpen={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("marca la fecha vencida con el token destructive", () => {
    const overdueDate = "2020-01-01";
    const ticket = buildTicket({ due_date: overdueDate });

    render(<TicketCard ticket={ticket} onOpen={vi.fn()} />);

    const dueDateLabel = screen.getByText("01/01");
    expect(dueDateLabel.className).toMatch(/text-destructive/);
  });

  it("no marca con destructive una fecha que todavia no vencio", () => {
    const farFutureDate = "2099-01-01";
    const ticket = buildTicket({ due_date: farFutureDate });

    render(<TicketCard ticket={ticket} onOpen={vi.fn()} />);

    const dueDateLabel = screen.getByText("01/01");
    expect(dueDateLabel.className).not.toMatch(/text-destructive/);
  });

  it("no renderiza fecha cuando due_date es null", () => {
    const ticket = buildTicket({ due_date: null });

    render(<TicketCard ticket={ticket} onOpen={vi.fn()} />);

    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });

  it("muestra '+N' cuando hay mas de 3 asignados", () => {
    const ticket = buildTicket({
      assignees: [
        buildUser({ id: "u1", full_name: "Ana Perez" }),
        buildUser({ id: "u2", full_name: "Luis Gomez" }),
        buildUser({ id: "u3", full_name: "Marta Diaz" }),
        buildUser({ id: "u4", full_name: "Carlos Ruiz" }),
        buildUser({ id: "u5", full_name: "Elena Vidal" }),
      ],
    });

    render(<TicketCard ticket={ticket} onOpen={vi.fn()} />);

    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
