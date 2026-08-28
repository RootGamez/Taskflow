import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  useCreateRelation,
  useDeleteRelation,
  useTicketRelations,
} from "@/features/relations/hooks/useTicketRelations";
import { relationQueryKeys } from "@/features/relations/lib/relationQueryKeys";
import type { TicketRelation } from "@/features/relations/types/relation.types";

const relationsApiMock = vi.hoisted(() => ({
  getTicketRelations: vi.fn(),
  createTicketRelation: vi.fn(),
  deleteTicketRelation: vi.fn(),
}));

vi.mock("@/features/relations/api/relationsApi", () => relationsApiMock);

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
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { client, Wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTicketRelations", () => {
  it("queries relations when ticketId is present", async () => {
    relationsApiMock.getTicketRelations.mockResolvedValue([buildRelation()]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useTicketRelations("project-1", "ticket-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(relationsApiMock.getTicketRelations).toHaveBeenCalledWith("project-1", "ticket-1");
    expect(result.current.data).toHaveLength(1);
  });

  it("does not fire with an empty ticketId", () => {
    const { Wrapper } = createWrapper();

    renderHook(() => useTicketRelations("project-1", ""), { wrapper: Wrapper });

    expect(relationsApiMock.getTicketRelations).not.toHaveBeenCalled();
  });
});

describe("useCreateRelation", () => {
  it("invalidates both tickets' relation lists", async () => {
    relationsApiMock.createTicketRelation.mockResolvedValue(buildRelation());
    const { client, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateRelation("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate({ relation_type: "blocks", ticket_id: "ticket-2" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(relationsApiMock.createTicketRelation).toHaveBeenCalledWith("project-1", "ticket-1", {
      relation_type: "blocks",
      ticket_id: "ticket-2",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: relationQueryKeys.list("ticket-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: relationQueryKeys.list("ticket-2") });
  });
});

describe("useDeleteRelation", () => {
  it("invalidates both tickets' relation lists", async () => {
    relationsApiMock.deleteTicketRelation.mockResolvedValue(undefined);
    const { client, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteRelation("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate({ relationId: "relation-1", otherTicketId: "ticket-2" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(relationsApiMock.deleteTicketRelation).toHaveBeenCalledWith("project-1", "ticket-1", "relation-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: relationQueryKeys.list("ticket-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: relationQueryKeys.list("ticket-2") });
  });
});
