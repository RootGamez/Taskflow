import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ticketsApi from "@/features/tickets/api/ticketsApi";
import { useUpdateTicket } from "@/features/tickets/hooks/useTickets";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
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
    title: "Ticket original",
    description: "",
    progress_notes: "",
    priority: "medium",
    order: 1,
    due_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    assignees: [],
    labels: [buildLabel()],
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

describe("useUpdateTicket — optimistic update de label_ids (D45)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no aplica label_ids al cache optimista", async () => {
    const originalTicket = buildTicket();
    let resolveUpdate!: (ticket: Ticket) => void;
    vi.spyOn(ticketsApi, "updateTicket").mockReturnValue(
      new Promise<Ticket>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(ticketQueryKeys.detail("ticket-1"), originalTicket);
    queryClient.setQueryData(ticketQueryKeys.list("project-1"), [originalTicket]);

    const { result } = renderHook(() => useUpdateTicket("project-1"), { wrapper: Wrapper });

    result.current.mutate({ ticketId: "ticket-1", payload: { label_ids: ["label-2"] } });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    const cachedDetail = queryClient.getQueryData<Ticket>(ticketQueryKeys.detail("ticket-1"));
    expect((cachedDetail as unknown as { label_ids?: string[] }).label_ids).toBeUndefined();
    expect(cachedDetail?.labels).toEqual(originalTicket.labels);

    resolveUpdate(originalTicket);
  });

  it("sigue aplicando campos escalares de forma optimista junto a label_ids", async () => {
    const originalTicket = buildTicket({ title: "Titulo viejo" });
    let resolveUpdate!: (ticket: Ticket) => void;
    vi.spyOn(ticketsApi, "updateTicket").mockReturnValue(
      new Promise<Ticket>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(ticketQueryKeys.detail("ticket-1"), originalTicket);
    queryClient.setQueryData(ticketQueryKeys.list("project-1"), [originalTicket]);

    const { result } = renderHook(() => useUpdateTicket("project-1"), { wrapper: Wrapper });

    result.current.mutate({
      ticketId: "ticket-1",
      payload: { title: "Titulo nuevo", label_ids: ["label-2"] },
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    const cachedDetail = queryClient.getQueryData<Ticket>(ticketQueryKeys.detail("ticket-1"));
    expect(cachedDetail?.title).toBe("Titulo nuevo");
    expect(cachedDetail?.labels).toEqual(originalTicket.labels);
    expect((cachedDetail as unknown as { label_ids?: string[] }).label_ids).toBeUndefined();

    resolveUpdate(originalTicket);
  });

  it("sobrescribe el cache con la respuesta del servidor al tener exito", async () => {
    const originalTicket = buildTicket();
    const serverTicket = buildTicket({
      title: "Titulo nuevo",
      labels: [buildLabel({ id: "label-2", name: "Feature", color: "#2563EB" })],
    });
    vi.spyOn(ticketsApi, "updateTicket").mockResolvedValue(serverTicket);

    const { Wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(ticketQueryKeys.detail("ticket-1"), originalTicket);
    queryClient.setQueryData(ticketQueryKeys.list("project-1"), [originalTicket]);

    const { result } = renderHook(() => useUpdateTicket("project-1"), { wrapper: Wrapper });

    result.current.mutate({
      ticketId: "ticket-1",
      payload: { title: "Titulo nuevo", label_ids: ["label-2"] },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cachedDetail = queryClient.getQueryData<Ticket>(ticketQueryKeys.detail("ticket-1"));
    expect(cachedDetail).toEqual(serverTicket);

    const cachedList = queryClient.getQueryData<Ticket[]>(ticketQueryKeys.list("project-1"));
    expect(cachedList?.[0]).toEqual(serverTicket);
  });
});
