import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ticketsApi from "@/features/tickets/api/ticketsApi";
import { useCreateTicketInstant } from "@/features/tickets/hooks/useCreateTicketInstant";
import {
  DEFAULT_TICKET_DESCRIPTION,
  DEFAULT_TICKET_TITLE,
} from "@/features/tickets/lib/defaultTicketTemplate";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
import type { Ticket } from "@/features/tickets/types/ticket.types";

// docs/BRUTALIST_REDESIGN_PLAN.md §9 (RD-5..RD-9): la creación instantánea
// reemplaza al `CreateTicketModal`. No hay COVERED_PATHS para
// `features/tickets/hooks/**`, pero este archivo congela el contrato del
// hook: qué payload manda, que autoasigna al creador, que pre-siembra el
// cache del detalle y que navega con `state.justCreated`.

const navigate = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ userId: "user-1" as string | null }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: { user: { id: string } | null }) => unknown) =>
    selector({ user: authState.userId ? { id: authState.userId } : null }),
}));

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "ticket-new",
    project_id: "project-1",
    column_id: "column-1",
    created_by: "user-1",
    title: DEFAULT_TICKET_TITLE,
    description: JSON.stringify(DEFAULT_TICKET_DESCRIPTION),
    progress_notes: "",
    priority: "none",
    order: 1,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignees: [],
    labels: [],
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

describe("useCreateTicketInstant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = "user-1";
  });

  it("creates a ticket with the default template, priority none and the creator assigned", async () => {
    const created = buildTicket();
    const createSpy = vi.spyOn(ticketsApi, "createTicket").mockResolvedValue(created);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateTicketInstant("project-1"), { wrapper: Wrapper });
    await result.current.createTicketInstant({ columnId: "column-1" });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const [projectId, payload] = createSpy.mock.calls[0];
    expect(projectId).toBe("project-1");
    expect(payload).toMatchObject({
      title: DEFAULT_TICKET_TITLE,
      priority: "none",
      due_date: null,
      column_id: "column-1",
      assignee_ids: ["user-1"],
    });
    expect(payload.description).toBe(JSON.stringify(DEFAULT_TICKET_DESCRIPTION));
  });

  it("pre-seeds the ticket detail cache and navigates with state.justCreated", async () => {
    const created = buildTicket({ id: "ticket-42" });
    vi.spyOn(ticketsApi, "createTicket").mockResolvedValue(created);
    const { Wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useCreateTicketInstant("project-1"), { wrapper: Wrapper });
    await result.current.createTicketInstant({ columnId: "column-1" });

    expect(queryClient.getQueryData(ticketQueryKeys.detail("ticket-42"))).toEqual(created);
    expect(navigate).toHaveBeenCalledWith("/tickets/ticket-42", { state: { justCreated: true } });
  });

  it("omits column_id (backend picks the first column) and forwards inherited sprints", async () => {
    const createSpy = vi.spyOn(ticketsApi, "createTicket").mockResolvedValue(buildTicket());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateTicketInstant("project-1"), { wrapper: Wrapper });
    await result.current.createTicketInstant({ sprintIds: ["sprint-1"] });

    const payload = createSpy.mock.calls[0][1];
    expect(payload.column_id).toBeUndefined();
    expect(payload.sprint_ids).toEqual(["sprint-1"]);
  });

  it("does not send assignee_ids when there is no authenticated user", async () => {
    authState.userId = null;
    const createSpy = vi.spyOn(ticketsApi, "createTicket").mockResolvedValue(buildTicket());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateTicketInstant("project-1"), { wrapper: Wrapper });
    await result.current.createTicketInstant({ columnId: "column-1" });

    expect(createSpy.mock.calls[0][1].assignee_ids).toBeUndefined();
  });

  it("exposes isCreating while the mutation is in flight", async () => {
    let resolveCreate!: (ticket: Ticket) => void;
    vi.spyOn(ticketsApi, "createTicket").mockReturnValue(
      new Promise<Ticket>((resolve) => {
        resolveCreate = resolve;
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useCreateTicketInstant("project-1"), { wrapper: Wrapper });
    expect(result.current.isCreating).toBe(false);

    void result.current.createTicketInstant({ columnId: "column-1" });
    await waitFor(() => expect(result.current.isCreating).toBe(true));

    resolveCreate(buildTicket());
    await waitFor(() => expect(result.current.isCreating).toBe(false));
  });
});
