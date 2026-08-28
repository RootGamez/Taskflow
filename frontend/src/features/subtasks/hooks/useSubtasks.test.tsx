import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as subtasksApi from "@/features/subtasks/api/subtasksApi";
import { useCreateSubtask, useDeleteSubtask, useSubtasks, useToggleSubtask } from "@/features/subtasks/hooks/useSubtasks";
import { subtaskQueryKeys } from "@/features/subtasks/lib/subtaskQueryKeys";
import type { SubTask } from "@/features/subtasks/types/subtask.types";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

function buildSubtask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: "subtask-1",
    ticket_id: "ticket-1",
    title: "Escribir los tests",
    is_done: false,
    order: 1,
    assignee: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useSubtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta las subtareas cuando ticketId esta presente", async () => {
    const subtasks = [buildSubtask()];
    const spy = vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue(subtasks);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSubtasks("project-1", "ticket-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("project-1", "ticket-1");
    expect(result.current.data).toBe(subtasks);
  });

  it("no dispara la query si ticketId esta vacio", () => {
    const spy = vi.spyOn(subtasksApi, "getSubtasks").mockResolvedValue([]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSubtasks("project-1", ""), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useToggleSubtask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida las subtareas Y la lista de tickets al tildar una subtarea", async () => {
    vi.spyOn(subtasksApi, "updateSubtask").mockResolvedValue(buildSubtask({ is_done: true }));
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useToggleSubtask("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate({ subtaskId: "subtask-1", isDone: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subtaskQueryKeys.list("ticket-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ticketQueryKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ticketQueryKeys.detail("ticket-1") });
  });
});

describe("useCreateSubtask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida las subtareas Y la lista de tickets al crear una subtarea", async () => {
    vi.spyOn(subtasksApi, "createSubtask").mockResolvedValue(buildSubtask());
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateSubtask("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate({ title: "Nueva subtarea" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subtaskQueryKeys.list("ticket-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ticketQueryKeys.list("project-1") });
  });
});

describe("useDeleteSubtask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida las subtareas Y la lista de tickets al borrar una subtarea", async () => {
    vi.spyOn(subtasksApi, "deleteSubtask").mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteSubtask("project-1", "ticket-1"), { wrapper: Wrapper });

    result.current.mutate("subtask-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: subtaskQueryKeys.list("ticket-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ticketQueryKeys.list("project-1") });
  });
});
