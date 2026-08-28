import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PageTreeItem, type PageTreeItemProps } from "@/features/pages/components/PageTreeItem";

function renderItem(overrides: Partial<PageTreeItemProps> = {}) {
  const props: PageTreeItemProps = {
    workspaceSlug: "acme",
    pageId: "page-1",
    title: "Onboarding del equipo",
    icon: "",
    childCount: 0,
    depth: 0,
    isActive: false,
    isExpanded: false,
    onToggleExpand: vi.fn(),
    ...overrides,
  };

  return render(
    <MemoryRouter>
      <PageTreeItem {...props} />
    </MemoryRouter>,
  );
}

describe("PageTreeItem", () => {
  it("renders the icon when present", () => {
    renderItem({ icon: "📘" });

    expect(screen.getByText("📘")).toBeInTheDocument();
  });

  it("falls back to a FileText icon", () => {
    const { container } = renderItem({ icon: "" });

    expect(container.querySelector(".lucide-file-text")).not.toBeNull();
  });

  it("renders a chevron only when child_count > 0", () => {
    const withoutChildren = renderItem({ childCount: 0 });
    expect(withoutChildren.container.querySelector(".lucide-chevron-right")).toBeNull();
    expect(withoutChildren.container.querySelector(".lucide-chevron-down")).toBeNull();
    withoutChildren.unmount();

    const withChildren = renderItem({ childCount: 3, isExpanded: false });
    expect(withChildren.container.querySelector(".lucide-chevron-right")).not.toBeNull();
  });

  it("indents by depth", () => {
    const { container } = renderItem({ depth: 2 });

    const row = container.firstElementChild as HTMLElement;
    expect(row.style.paddingLeft).toBe("32px");
  });

  it("marks the active page", () => {
    const { container } = renderItem({ isActive: true });

    const row = container.firstElementChild as HTMLElement;
    expect(row.className).toContain("bg-brand-50");
  });
});
