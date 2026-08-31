import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMoveMyTask } from "@/features/mytasks/hooks/useMoveMyTask";
import { myTaskQueryKeys } from "@/features/mytasks/lib/myTaskQueryKeys";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import * as ticketsApi from "@/features/tickets/api/ticketsApi";

function buildTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: "t1",
    project: {
      id: "p1",
      name: "Core",
      key: "CORE",
      color: "#2563EB",
      workspace_slug: "acme",
    },
    project_id: "p1",
    column_id: "col-1",
    workspace_status_id: "s-todo",
    created_by: "u1",
    title: "Tarea",
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

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(myTaskQueryKeys.list(), [buildTask()]);

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, ...renderHook(() => useMoveMyTask(), { wrapper }) };
}

describe("useMoveMyTask", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("mueve la tarea en la caché antes de que responda el backend", async () => {
    vi.spyOn(ticketsApi, "updateTicket").mockImplementation(
      () => new Promise(() => {}) as ReturnType<typeof ticketsApi.updateTicket>,
    );
    const { queryClient, result } = setup();

    act(() => {
      result.current.mutate({ task: buildTask(), workspaceStatusId: "s-doing" });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<MyTask[]>(myTaskQueryKeys.list());
      expect(cached?.[0].workspace_status_id).toBe("s-doing");
    });
  });

  it("revierte la caché si el backend rechaza el movimiento", async () => {
    vi.spyOn(ticketsApi, "updateTicket").mockRejectedValue(new Error("403"));
    const { queryClient, result } = setup();

    act(() => {
      result.current.mutate({ task: buildTask(), workspaceStatusId: "s-doing" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<MyTask[]>(myTaskQueryKeys.list());
    expect(cached?.[0].workspace_status_id).toBe("s-todo");
  });

  it("manda el estado nuevo al proyecto de la tarea", async () => {
    const updateTicket = vi
      .spyOn(ticketsApi, "updateTicket")
      .mockResolvedValue(buildTask({ workspace_status_id: "s-doing" }));
    const { result } = setup();

    await act(async () => {
      await result.current.mutateAsync({ task: buildTask(), workspaceStatusId: "s-doing" });
    });

    expect(updateTicket).toHaveBeenCalledWith("p1", "t1", { workspace_status_id: "s-doing" });
  });
});
