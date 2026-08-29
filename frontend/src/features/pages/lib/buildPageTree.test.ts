import { describe, expect, it } from "vitest";

import { buildPageTree, type PageTreeNode } from "@/features/pages/lib/buildPageTree";
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

describe("buildPageTree", () => {
  it("returns an empty array for no pages", () => {
    expect(buildPageTree([])).toEqual([]);
  });

  it("nests children under their parent", () => {
    const root = buildPage({ id: "root" });
    const child = buildPage({ id: "child", parent_id: "root" });

    const tree = buildPageTree([root, child]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe("child");
  });

  it("sorts siblings by order then created_at", () => {
    const second = buildPage({ id: "b", order: 2, created_at: "2026-01-01T00:00:00Z" });
    const firstByOrder = buildPage({ id: "a", order: 1, created_at: "2026-01-02T00:00:00Z" });
    const tieBrokenByCreatedAt = buildPage({ id: "c", order: 2, created_at: "2026-01-03T00:00:00Z" });

    const tree = buildPageTree([second, firstByOrder, tieBrokenByCreatedAt]);

    expect(tree.map((node) => node.id)).toEqual(["a", "b", "c"]);
  });

  it("promotes orphans (unknown parent) to the root", () => {
    const orphan = buildPage({ id: "orphan", parent_id: "does-not-exist" });

    const tree = buildPageTree([orphan]);

    expect(tree.map((node) => node.id)).toEqual(["orphan"]);
  });

  it("does not loop on cyclic data", () => {
    const a = buildPage({ id: "a", parent_id: "b" });
    const b = buildPage({ id: "b", parent_id: "a" });

    const tree = buildPageTree([a, b]);

    const visitedIds = tree.flatMap((node) => [node.id, ...node.children.map((child) => child.id)]);
    expect([...visitedIds].sort()).toEqual(["a", "b"]);
  });

  it("stops at max depth", () => {
    const chain: PageSummary[] = [];
    for (let level = 0; level < 8; level += 1) {
      chain.push(buildPage({ id: `level-${level}`, parent_id: level === 0 ? null : `level-${level - 1}` }));
    }

    const tree = buildPageTree(chain, 3);

    function maxDepthOf(nodes: PageTreeNode[], depth = 0): number {
      return nodes.reduce(
        (deepest, node) =>
          Math.max(deepest, node.children.length > 0 ? maxDepthOf(node.children, depth + 1) : depth),
        depth,
      );
    }

    expect(maxDepthOf(tree)).toBe(3);
  });
});
