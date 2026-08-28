import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as relationsApi from "@/features/relations/api/relationsApi";
import { TicketRelationsSection } from "@/features/relations/components/TicketRelationsSection";
import type { TicketRelation } from "@/features/relations/types/relation.types";
import * as ticketsApi from "@/features/tickets/api/ticketsApi";

// jsdom no implementa `Element.scrollIntoView`; el picker de
// `AddRelationPopover` (cmdk) lo necesita apenas monta un `CommandGroup`
// con items. Mismo guard por archivo que `CommandPaletteTickets.test.tsx`.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function buildRelation(overrides: Partial<TicketRelation> = {}): TicketRelation {
  return {
    id: "relation-1",
    relation_type: "blocks",
    stored_type: "blocks",
    direction: "outgoing",
    ticket: {
      id: "ticket-2",
      title: "Otro ticket",
      reference: "TASK-2",
      priority: "medium",
      column_name: "Backlog",
    },
    created_at: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("TicketRelationsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state with no relations", async () => {
    vi.spyOn(relationsApi, "getTicketRelations").mockResolvedValue([]);
    vi.spyOn(ticketsApi, "getTicketsByProject").mockResolvedValue([]);

    render(<TicketRelationsSection ticketId="ticket-1" projectId="project-1" canEdit />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText(/sin relaciones/i)).toBeInTheDocument();
  });

  it("renders one group per present type", async () => {
    vi.spyOn(relationsApi, "getTicketRelations").mockResolvedValue([
      buildRelation({ id: "r1", relation_type: "blocks" }),
      buildRelation({ id: "r2", relation_type: "relates_to", ticket: { ...buildRelation().ticket, id: "ticket-3" } }),
    ]);
    vi.spyOn(ticketsApi, "getTicketsByProject").mockResolvedValue([]);

    render(<TicketRelationsSection ticketId="ticket-1" projectId="project-1" canEdit />, {
      wrapper: createWrapper(),
    });

    expect(await screen.findByText("Bloquea a")).toBeInTheDocument();
    expect(screen.getByText("Relacionado con")).toBeInTheDocument();
  });

  it('hides "+ Agregar relación" when canEdit is false', async () => {
    vi.spyOn(relationsApi, "getTicketRelations").mockResolvedValue([]);
    vi.spyOn(ticketsApi, "getTicketsByProject").mockResolvedValue([]);

    render(<TicketRelationsSection ticketId="ticket-1" projectId="project-1" canEdit={false} />, {
      wrapper: createWrapper(),
    });

    await screen.findByText(/sin relaciones/i);
    expect(screen.queryByText(/agregar relaci/i)).not.toBeInTheDocument();
  });

  it("navigates to the related ticket when a badge is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(relationsApi, "getTicketRelations").mockResolvedValue([buildRelation()]);
    vi.spyOn(ticketsApi, "getTicketsByProject").mockResolvedValue([]);

    render(<TicketRelationsSection ticketId="ticket-1" projectId="project-1" canEdit />, {
      wrapper: createWrapper(),
    });

    await user.click(await screen.findByText("Otro ticket"));

    expect(mockNavigate).toHaveBeenCalledWith("/tickets/ticket-2");
  });

  it("creates a relation from the picker and closes the popover", async () => {
    const user = userEvent.setup();
    vi.spyOn(relationsApi, "getTicketRelations").mockResolvedValue([]);
    vi.spyOn(ticketsApi, "getTicketsByProject").mockResolvedValue([
      {
        id: "ticket-3",
        project_id: "project-1",
        column_id: "column-1",
        created_by: null,
        title: "Ticket disponible",
        description: "",
        progress_notes: "",
        priority: "medium",
        order: 1,
        due_date: null,
        created_at: "2026-08-27T10:00:00Z",
        updated_at: "2026-08-27T10:00:00Z",
        assignees: [],
        labels: [],
        reference: "TASK-3",
      },
    ]);
    const createSpy = vi.spyOn(relationsApi, "createTicketRelation").mockResolvedValue(buildRelation());

    render(<TicketRelationsSection ticketId="ticket-1" projectId="project-1" canEdit />, {
      wrapper: createWrapper(),
    });

    await screen.findByText(/sin relaciones/i);
    await user.click(screen.getByText("+ Agregar relación"));
    await user.click(await screen.findByText("Ticket disponible"));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith("project-1", "ticket-1", {
        relation_type: "relates_to",
        ticket_id: "ticket-3",
      }),
    );
    await waitFor(() => expect(screen.queryByPlaceholderText(/buscar/i)).not.toBeInTheDocument());
  });

  it("removes a relation when its remove button is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(relationsApi, "getTicketRelations").mockResolvedValue([buildRelation()]);
    vi.spyOn(ticketsApi, "getTicketsByProject").mockResolvedValue([]);
    const deleteSpy = vi.spyOn(relationsApi, "deleteTicketRelation").mockResolvedValue(undefined);

    render(<TicketRelationsSection ticketId="ticket-1" projectId="project-1" canEdit />, {
      wrapper: createWrapper(),
    });

    await user.click(await screen.findByRole("button", { name: /quitar/i }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("project-1", "ticket-1", "relation-1"));
  });
});
