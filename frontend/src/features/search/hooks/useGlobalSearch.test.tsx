import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as searchApi from "@/features/search/api/searchApi";
import { useGlobalSearch } from "@/features/search/hooks/useGlobalSearch";
import type { SearchResult } from "@/features/search/types/search.types";

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const SAMPLE_RESULTS: SearchResult[] = [
  {
    id: "ticket-1",
    title: "Arreglar el login",
    reference: "TASK-1",
    priority: "high",
    due_date: null,
    column_name: "Backlog",
    project: { id: "project-1", name: "Core", key: "TASK", color: "#2563EB", workspace_slug: "producto" },
  },
];

describe("useGlobalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire below two characters", async () => {
    const spy = vi.spyOn(searchApi, "searchTickets").mockResolvedValue(SAMPLE_RESULTS);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useGlobalSearch("a"), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("fires with the debounced query", async () => {
    const spy = vi.spyOn(searchApi, "searchTickets").mockResolvedValue(SAMPLE_RESULTS);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Arranca en "" (bajo el minimo) para que la primera tecla no dispare
    // una request "gratis" en el mount -- solo el ultimo valor, ya
    // asentado 250ms, debe llegar a `searchTickets`.
    const { result, rerender } = renderHook(({ query }) => useGlobalSearch(query), {
      wrapper: createWrapper(queryClient),
      initialProps: { query: "" },
    });

    rerender({ query: "l" });
    rerender({ query: "lo" });
    rerender({ query: "log" });
    rerender({ query: "logi" });
    rerender({ query: "login" });

    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ q: "login", workspaceSlug: undefined });
    expect(result.current.results).toEqual(SAMPLE_RESULTS);
  });

  it("passes the workspace slug when present", async () => {
    const spy = vi.spyOn(searchApi, "searchTickets").mockResolvedValue(SAMPLE_RESULTS);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    renderHook(() => useGlobalSearch("login", "producto"), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(spy).toHaveBeenCalledWith({ q: "login", workspaceSlug: "producto" });
  });

  it("returns an empty array while loading", async () => {
    vi.spyOn(searchApi, "searchTickets").mockImplementation(() => new Promise(() => {}));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useGlobalSearch("login"), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("surfaces the error state", async () => {
    vi.spyOn(searchApi, "searchTickets").mockRejectedValue(new Error("network down"));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { result } = renderHook(() => useGlobalSearch("login"), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.results).toEqual([]);
  });
});
