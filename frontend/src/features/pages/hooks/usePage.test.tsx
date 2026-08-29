import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as pagesApi from "@/features/pages/api/pagesApi";
import { usePage } from "@/features/pages/hooks/usePage";
import type { PageDetail } from "@/features/pages/types/page.types";

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper };
}

function buildDetail(overrides: Partial<PageDetail> = {}): PageDetail {
  return {
    id: "page-1",
    parent_id: null,
    project_id: null,
    title: "Onboarding",
    icon: "",
    order: 1,
    child_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: null,
    content: "",
    created_by: null,
    breadcrumb: [],
    ...overrides,
  };
}

describe("usePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta la pagina cuando workspaceSlug y pageId estan presentes", async () => {
    const detail = buildDetail();
    const spy = vi.spyOn(pagesApi, "getPage").mockResolvedValue(detail);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePage("acme", "page-1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("acme", "page-1");
    expect(result.current.data).toBe(detail);
  });

  it("no dispara la query si pageId esta vacio", () => {
    const spy = vi.spyOn(pagesApi, "getPage").mockResolvedValue(buildDetail());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePage("acme", ""), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });

  it("no dispara la query si workspaceSlug esta vacio", () => {
    const spy = vi.spyOn(pagesApi, "getPage").mockResolvedValue(buildDetail());
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePage("", "page-1"), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });
});
