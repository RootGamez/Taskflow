import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as myTasksApi from "@/features/mytasks/api/myTasksApi";
import { useMyTasks } from "@/features/mytasks/hooks/useMyTasks";
import type { MyTask } from "@/features/mytasks/types/myTask.types";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const TASK: MyTask = {
  id: "task-1",
  project_id: "project-1",
  column_id: "column-1",
  created_by: "user-1",
  title: "Arreglar login",
  description: "",
  progress_notes: "",
  priority: "high",
  order: 1,
  due_date: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  assignees: [],
  labels: [],
  project: { id: "project-1", name: "Core Platform", key: "CORE", color: "#2563EB", workspace_slug: "producto" },
};

describe("useMyTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta /tickets/mine/ al montar", async () => {
    const spy = vi.spyOn(myTasksApi, "getMyTasks").mockResolvedValue([TASK]);

    const { result } = renderHook(() => useMyTasks(), { wrapper: createWrapper() });

    // No se puede esperar `isSuccess === true` acá: con `placeholderData`
    // el status ya es "success" de forma sincrónica (con el placeholder),
    // así que `waitFor` resolvería antes de que el mock real responda.
    await waitFor(() => expect(result.current.data).toEqual([TASK]));

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("expone un array vacio mientras carga", () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMyTasks(), { wrapper: createWrapper() });

    expect(result.current.fetchStatus).toBe("fetching");
    expect(result.current.data).toEqual([]);
  });

  it("expone el estado de error", async () => {
    vi.spyOn(myTasksApi, "getMyTasks").mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useMyTasks(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
