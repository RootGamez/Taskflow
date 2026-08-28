import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageTreeNav } from "@/features/pages/components/PageTreeNav";
import { usePages } from "@/features/pages/hooks/usePages";
import type { PageSummary } from "@/features/pages/types/page.types";
import { useUIStore } from "@/store/uiStore";

vi.mock("@/features/pages/hooks/usePages", () => ({
  usePages: vi.fn(),
}));

const mockedUsePages = vi.mocked(usePages);

function buildPage(overrides: Partial<PageSummary> = {}): PageSummary {
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

function renderNav() {
  return render(
    <MemoryRouter>
      <PageTreeNav workspaceSlug="acme" />
    </MemoryRouter>,
  );
}

describe("PageTreeNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useUIStore.setState({ sidebarCollapsed: false });
  });

  it("renders the empty state with no pages", () => {
    mockedUsePages.mockReturnValue({ data: [] } as unknown as ReturnType<typeof usePages>);

    renderNav();

    expect(screen.getByText(/sin páginas todavía/i)).toBeInTheDocument();
  });

  it("renders the root pages", () => {
    mockedUsePages.mockReturnValue({
      data: [buildPage({ id: "root-1", title: "Onboarding" }), buildPage({ id: "root-2", title: "Politicas" })],
    } as unknown as ReturnType<typeof usePages>);

    renderNav();

    expect(screen.getByText("Onboarding")).toBeInTheDocument();
    expect(screen.getByText("Politicas")).toBeInTheDocument();
  });

  it("expands a node on chevron click", async () => {
    const user = userEvent.setup();
    mockedUsePages.mockReturnValue({
      data: [
        buildPage({ id: "root", title: "Raiz", child_count: 1 }),
        buildPage({ id: "child", title: "Hijo", parent_id: "root" }),
      ],
    } as unknown as ReturnType<typeof usePages>);

    renderNav();

    expect(screen.queryByText("Hijo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /expandir/i }));

    expect(screen.getByText("Hijo")).toBeInTheDocument();
  });

  it("hides itself when the sidebar is collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true });
    mockedUsePages.mockReturnValue({
      data: [buildPage({ id: "root-1", title: "Onboarding" })],
    } as unknown as ReturnType<typeof usePages>);

    const { container } = renderNav();

    expect(container).toBeEmptyDOMElement();
  });
});
