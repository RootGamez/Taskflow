import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as pagesApi from "@/features/pages/api/pagesApi";
import { useCreatePage, useDeletePage, usePages, useUpdatePage } from "@/features/pages/hooks/usePages";
import { pageQueryKeys } from "@/features/pages/lib/pageQueryKeys";
import type { PageDetail, PageSummary } from "@/features/pages/types/page.types";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return { Wrapper, queryClient };
}

function buildSummary(overrides: Partial<PageSummary> = {}): PageSummary {
  return {
    id: "page-1",
    parent_id: null,
    project_id: null,
    title: "Pagina",
    icon: "",
    order: 1,
    child_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    updated_by: null,
    ...overrides,
  };
}

function buildDetail(overrides: Partial<PageDetail> = {}): PageDetail {
  return {
    ...buildSummary(),
    content: "",
    created_by: null,
    breadcrumb: [],
    ...overrides,
  };
}

describe("usePages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta las paginas cuando workspaceSlug esta presente", async () => {
    const pages = [buildSummary()];
    const spy = vi.spyOn(pagesApi, "getPages").mockResolvedValue(pages);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePages("acme"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("acme", { q: undefined, project: undefined });
    expect(result.current.data).toBe(pages);
  });

  it("no dispara la query si workspaceSlug esta vacio", () => {
    const spy = vi.spyOn(pagesApi, "getPages").mockResolvedValue([]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePages(""), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(spy).not.toHaveBeenCalled();
  });

  it("manda q cuando se provee", async () => {
    const spy = vi.spyOn(pagesApi, "getPages").mockResolvedValue([]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => usePages("acme", "onboarding"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledWith("acme", { q: "onboarding", project: undefined });
  });
});

describe("useCreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida el listado al crear una pagina", async () => {
    vi.spyOn(pagesApi, "createPage").mockResolvedValue(buildDetail());
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePage("acme"), { wrapper: Wrapper });

    result.current.mutate({ title: "Nueva" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageQueryKeys.allLists("acme") });
  });
});

describe("useUpdatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida el listado Y el detalle al actualizar", async () => {
    vi.spyOn(pagesApi, "updatePage").mockResolvedValue(buildDetail());
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdatePage("acme", "page-1"), { wrapper: Wrapper });

    result.current.mutate({ title: "Editada" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageQueryKeys.allLists("acme") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageQueryKeys.detail("acme", "page-1") });
  });
});

describe("useDeletePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalida el listado y navega afuera al borrar", async () => {
    vi.spyOn(pagesApi, "deletePage").mockResolvedValue(undefined);
    const { Wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePage("acme"), { wrapper: Wrapper });

    result.current.mutate("page-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pageQueryKeys.allLists("acme") });
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/acme/pages");
  });
});
