import { describe, expect, it } from "vitest";

import type { PageTreeNode } from "@/features/pages/lib/buildPageTree";
import { flattenPageTree } from "@/features/pages/lib/flattenPageTree";
import type { PageSummary } from "@/features/pages/types/page.types";

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

function buildNode(overrides: Partial<PageSummary> = {}, children: PageTreeNode[] = []): PageTreeNode {
  return { ...buildPage(overrides), children };
}

describe("flattenPageTree", () => {
  it("flattens depth-first with a depth field", () => {
    const grandchild = buildNode({ id: "grandchild", parent_id: "child" });
    const child = buildNode({ id: "child", parent_id: "root" }, [grandchild]);
    const root = buildNode({ id: "root" }, [child]);

    const flat = flattenPageTree([root]);

    expect(flat.map((item) => [item.id, item.depth])).toEqual([
      ["root", 0],
      ["child", 1],
      ["grandchild", 2],
    ]);
  });

  it("skips the children of collapsed nodes", () => {
    const child = buildNode({ id: "child", parent_id: "root" });
    const root = buildNode({ id: "root" }, [child]);

    const flat = flattenPageTree([root], new Set(["root"]));

    expect(flat.map((item) => item.id)).toEqual(["root"]);
  });
});
