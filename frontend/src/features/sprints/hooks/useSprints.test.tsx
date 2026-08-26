import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as sprintsApi from "@/features/sprints/api/sprintsApi";
import {
  useActivateSprint,
  useCompleteSprint,
  useCreateSprint,
  useDeleteSprint,
  useSprints,
  useUpdateSprint,
} from "@/features/sprints/hooks/useSprints";
import { sprintQueryKeys } from "@/features/sprints/lib/sprintQueryKeys";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
import type { Sprint } from "@/features/sprints/types/sprint.types";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSprints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries sprints when projectId is present", async () => {
    const sprints: Sprint[] = [
      {
        id: "sprint-1",
        project_id: "project-1",
        name: "Sprint 1",
        goal: "",
        start_date: "2026-09-01",
        end_date: "2026-09-14",
        status: "planned",
        ticket_count: 0,
        completed_ticket_count: 0,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ];
    const spy = vi.spyOn(sprintsApi, "getSprintsByProject").mockResolvedValue(sprints);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSprints("project-1"), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("project-1");
    expect(result.current.data).toBe(sprints);
  });

  it("does not fire when projectId is empty", () => {
    const spy = vi.spyOn(sprintsApi, "getSprintsByProject").mockResolvedValue([]);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useSprints(""), { wrapper: createWrapper(queryClient) });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });

  it("useActivateSprint invalidates the sprint list on success", async () => {
    vi.spyOn(sprintsApi, "activateSprint").mockResolvedValue({} as Sprint);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useActivateSprint("project-1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("sprint-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintQueryKeys.list("project-1") });
  });

  it("useCreateSprint invalidates the sprint list on success", async () => {
    vi.spyOn(sprintsApi, "createSprint").mockResolvedValue({} as Sprint);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateSprint("project-1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ name: "Sprint 1", start_date: "2026-09-01", end_date: "2026-09-14" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintQueryKeys.list("project-1") });
  });

  it("useUpdateSprint invalidates the sprint list on success", async () => {
    vi.spyOn(sprintsApi, "updateSprint").mockResolvedValue({} as Sprint);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateSprint("project-1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate({ sprintId: "sprint-1", payload: { name: "Renombrado" } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintQueryKeys.list("project-1") });
  });

  it("useCompleteSprint invalidates the sprint list on success", async () => {
    vi.spyOn(sprintsApi, "completeSprint").mockResolvedValue({} as Sprint);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCompleteSprint("project-1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("sprint-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintQueryKeys.list("project-1") });
  });

  it("useDeleteSprint invalidates sprint list AND ticket list", async () => {
    vi.spyOn(sprintsApi, "deleteSprint").mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteSprint("project-1"), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate("sprint-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: sprintQueryKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ticketQueryKeys.list("project-1") });
  });
});
