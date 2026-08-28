import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelationGroup } from "@/features/relations/components/RelationGroup";
import type { TicketRelation } from "@/features/relations/types/relation.types";

function buildRelation(overrides: Partial<TicketRelation> = {}): TicketRelation {
  return {
    id: "relation-1",
    relation_type: "blocked_by",
    stored_type: "blocks",
    direction: "incoming",
    ticket: {
      id: "ticket-2",
      title: "Otro ticket",
      reference: "TASK-2",
      priority: "medium",
      column_name: "Backlog",
    },
    created_at: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

describe("RelationGroup", () => {
  it("renders the Spanish group heading", () => {
    render(
      <RelationGroup type="blocked_by" relations={[buildRelation()]} canEdit={false} onOpen={vi.fn()} />,
    );

    expect(screen.getByText("Bloqueado por")).toBeInTheDocument();
  });

  it("renders one badge per relation", () => {
    const relations = [
      buildRelation({ id: "r1", ticket: { ...buildRelation().ticket, id: "t1", title: "Primer ticket" } }),
      buildRelation({ id: "r2", ticket: { ...buildRelation().ticket, id: "t2", title: "Segundo ticket" } }),
    ];

    render(<RelationGroup type="blocked_by" relations={relations} canEdit={false} onOpen={vi.fn()} />);

    expect(screen.getByText("Primer ticket")).toBeInTheDocument();
    expect(screen.getByText("Segundo ticket")).toBeInTheDocument();
  });
});
