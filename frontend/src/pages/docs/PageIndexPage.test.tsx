import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreatePage, usePages } from "@/features/pages/hooks/usePages";
import type { PageDetail, PageSummary } from "@/features/pages/types/page.types";
import PageIndexPage from "@/pages/docs/PageIndexPage";

vi.mock("@/features/pages/hooks/usePages", () => ({
  usePages: vi.fn(),
  useCreatePage: vi.fn(),
}));

const mockedUsePages = vi.mocked(usePages);
const mockedUseCreatePage = vi.mocked(useCreatePage);

function buildSummary(overrides: Partial<PageSummary> = {}): PageSummary {
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
    ...overrides,
  };
}

function buildDetail(overrides: Partial<PageDetail> = {}): PageDetail {
  return { ...buildSummary(), content: "", created_by: null, breadcrumb: [], ...overrides };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/acme/pages"]}>
      <Routes>
        <Route path="/workspaces/:workspaceSlug/pages" element={<PageIndexPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PageIndexPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseCreatePage.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(buildDetail()),
      isPending: false,
    } as unknown as ReturnType<typeof useCreatePage>);
  });

  it("renders the empty state with a CTA", () => {
    mockedUsePages.mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof usePages>);

    renderPage();

    expect(screen.getByText(/todavía no hay páginas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear página/i })).toBeInTheDocument();
  });

  it("filters as the user types", async () => {
    const user = userEvent.setup();
    mockedUsePages.mockReturnValue({
      data: [buildSummary()],
      isLoading: false,
    } as unknown as ReturnType<typeof usePages>);

    renderPage();

    await user.type(screen.getByLabelText(/buscar páginas/i), "onboarding");

    await waitFor(() => {
      expect(mockedUsePages).toHaveBeenCalledWith("acme", "onboarding");
    });
  });
});
