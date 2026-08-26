import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as labelsApi from "@/features/labels/api/labelsApi";
import { useCreateLabel, useDeleteLabel, useLabels } from "@/features/labels/hooks/useLabels";
import { labelQueryKeys } from "@/features/labels/lib/labelQueryKeys";
import { ticketQueryKeys } from "@/features/tickets/lib/ticketQueryKeys";
import type { Label } from "@/features/tickets/types/ticket.types";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

function buildLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    project_id: "project-1",
    name: "Bug",
    color: "#DC2626",
    ...overrides,
  };
}

describe("useLabels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta los labels cuando projectId esta presente", async () => {
    const labels = [buildLabel()];
    const spy = vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue(labels);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useLabels("project-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("project-1");
    expect(result.current.data).toBe(labels);
  });

  it("no dispara la query si projectId esta vacio", () => {
    const spy = vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useLabels(""), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useCreateLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida la lista de labels al crear con exito", async () => {
    vi.spyOn(labelsApi, "createLabel").mockResolvedValue(buildLabel());
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateLabel("project-1"), { wrapper: Wrapper });

    result.current.mutate({ name: "Bug", color: "#DC2626" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: labelQueryKeys.list("project-1") });
  });
});

describe("useDeleteLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida la lista de labels Y la lista de tickets al borrar con exito", async () => {
    vi.spyOn(labelsApi, "deleteLabel").mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteLabel("project-1"), { wrapper: Wrapper });

    result.current.mutate("label-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: labelQueryKeys.list("project-1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ticketQueryKeys.list("project-1") });
  });
});
