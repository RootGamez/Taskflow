import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PageBreadcrumb } from "@/features/pages/components/PageBreadcrumb";
import type { PageBreadcrumbEntry } from "@/features/pages/types/page.types";

function renderBreadcrumb(breadcrumb: PageBreadcrumbEntry[]) {
  return render(
    <MemoryRouter>
      <PageBreadcrumb workspaceSlug="acme" breadcrumb={breadcrumb} />
    </MemoryRouter>,
  );
}

describe("PageBreadcrumb", () => {
  it("renders one crumb per ancestor", () => {
    const breadcrumb: PageBreadcrumbEntry[] = [
      { id: "root", title: "Raiz", icon: "" },
      { id: "child", title: "Hijo", icon: "" },
    ];

    renderBreadcrumb(breadcrumb);

    expect(screen.getByText("Raiz")).toBeInTheDocument();
    expect(screen.getByText("Hijo")).toBeInTheDocument();
  });

  it("renders nothing for a root page", () => {
    const { container } = renderBreadcrumb([]);

    expect(container).toBeEmptyDOMElement();
  });
});
