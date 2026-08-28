import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AddRelationPopover } from "@/features/relations/components/AddRelationPopover";
import type { TicketRelation } from "@/features/relations/types/relation.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";

// jsdom no implementa `Element.scrollIntoView`, y cmdk lo llama en un
// `useLayoutEffect` apenas monta un `<CommandGroup>` con items reales.
// Mismo guard por archivo que `CommandPaletteTickets.test.tsx` (WP-A).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-x",
    project_id: "project-1",
    column_id: "column-1",
    created_by: null,
    title: "Ticket generico",
    description: "",
    progress_notes: "",
    priority: "medium",
    order: 1,
    due_date: null,
    created_at: "2026-08-27T10:00:00Z",
    updated_at: "2026-08-27T10:00:00Z",
    assignees: [],
    labels: [],
    reference: null,
    ...overrides,
  };
}

function buildRelation(overrides: Partial<TicketRelation> = {}): TicketRelation {
  return {
    id: "relation-1",
    relation_type: "relates_to",
    stored_type: "relates_to",
    direction: "outgoing",
    ticket: {
      id: "ticket-2",
      title: "Migrar el schema de auth",
      reference: "TASK-2",
      priority: "medium",
      column_name: "Backlog",
    },
    created_at: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

const TICKETS: Ticket[] = [
  buildTicket({ id: "ticket-1", title: "Ticket actual", reference: "TASK-1" }),
  buildTicket({ id: "ticket-2", title: "Migrar el schema de auth", reference: "TASK-2" }),
  buildTicket({ id: "ticket-3", title: "Arreglar el login", reference: "TASK-3" }),
];

describe("AddRelationPopover", () => {
  it("excludes the current ticket from the picker", () => {
    render(<AddRelationPopover ticketId="ticket-1" tickets={TICKETS} existingRelations={[]} onSubmit={vi.fn()} />);

    expect(screen.queryByText("Ticket actual")).not.toBeInTheDocument();
    expect(screen.getByText("Migrar el schema de auth")).toBeInTheDocument();
    expect(screen.getByText("Arreglar el login")).toBeInTheDocument();
  });

  it("excludes already-related tickets", () => {
    render(
      <AddRelationPopover
        ticketId="ticket-1"
        tickets={TICKETS}
        existingRelations={[buildRelation()]}
        onSubmit={vi.fn()}
      />,
    );

    // El tipo por defecto del picker es "relates_to" (mismo tipo de la
    // relacion existente pasada arriba) -- ticket-2 debe quedar excluido.
    expect(screen.queryByText("Migrar el schema de auth")).not.toBeInTheDocument();
    expect(screen.getByText("Arreglar el login")).toBeInTheDocument();
  });

  it("filters by title", async () => {
    const user = userEvent.setup();
    render(<AddRelationPopover ticketId="ticket-1" tickets={TICKETS} existingRelations={[]} onSubmit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/buscar/i), "login");

    expect(screen.getByText("Arreglar el login")).toBeInTheDocument();
    expect(screen.queryByText("Migrar el schema de auth")).not.toBeInTheDocument();
  });

  it("filters by reference", async () => {
    const user = userEvent.setup();
    render(<AddRelationPopover ticketId="ticket-1" tickets={TICKETS} existingRelations={[]} onSubmit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/buscar/i), "TASK-3");

    expect(screen.getByText("Arreglar el login")).toBeInTheDocument();
    expect(screen.queryByText("Migrar el schema de auth")).not.toBeInTheDocument();
  });

  it("submits the selected type and ticket id", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AddRelationPopover ticketId="ticket-1" tickets={TICKETS} existingRelations={[]} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Bloquea a" }));
    await user.click(screen.getByText("Arreglar el login"));

    expect(onSubmit).toHaveBeenCalledWith({ relation_type: "blocks", ticket_id: "ticket-3" });
  });

  it("offers the five relation types", () => {
    render(<AddRelationPopover ticketId="ticket-1" tickets={TICKETS} existingRelations={[]} onSubmit={vi.fn()} />);

    for (const label of ["Bloqueado por", "Bloquea a", "Relacionado con", "Duplicado de", "Duplicado por"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("renders a ticket without a reference using only its title", () => {
    render(
      <AddRelationPopover
        ticketId="ticket-1"
        tickets={[buildTicket({ id: "ticket-9", title: "Sin referencia", reference: null })]}
        existingRelations={[]}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Sin referencia")).toBeInTheDocument();
    expect(screen.queryByText("TASK-9")).not.toBeInTheDocument();
  });

  it("renders the empty state when no ticket matches the query", async () => {
    const user = userEvent.setup();
    render(<AddRelationPopover ticketId="ticket-1" tickets={TICKETS} existingRelations={[]} onSubmit={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/buscar/i), "zzz-no-existe");

    expect(await screen.findByText("No se encontraron tickets.")).toBeInTheDocument();
  });
});
