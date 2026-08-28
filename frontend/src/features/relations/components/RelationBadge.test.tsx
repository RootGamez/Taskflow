import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RelationBadge } from "@/features/relations/components/RelationBadge";
import type { TicketRelation } from "@/features/relations/types/relation.types";

function buildRelation(overrides: Partial<TicketRelation> = {}): TicketRelation {
  return {
    id: "relation-1",
    relation_type: "blocks",
    stored_type: "blocks",
    direction: "outgoing",
    ticket: {
      id: "ticket-2",
      title: "Migrar el schema de auth",
      reference: "TASK-142",
      priority: "urgent",
      column_name: "En progreso",
    },
    created_at: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

describe("RelationBadge", () => {
  it("renders the reference and the title", () => {
    render(<RelationBadge relation={buildRelation()} canEdit={false} onOpen={vi.fn()} />);

    expect(screen.getByText("TASK-142")).toBeInTheDocument();
    expect(screen.getByText("Migrar el schema de auth")).toBeInTheDocument();
  });

  it("renders only the title when reference is null", () => {
    render(
      <RelationBadge
        relation={buildRelation({ ticket: { ...buildRelation().ticket, reference: null } })}
        canEdit={false}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByText("TASK-142")).not.toBeInTheDocument();
    expect(screen.getByText("Migrar el schema de auth")).toBeInTheDocument();
  });

  it("renders the type icon", () => {
    const { container } = render(<RelationBadge relation={buildRelation()} canEdit={false} onOpen={vi.fn()} />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("calls onOpen with the related ticket id", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<RelationBadge relation={buildRelation()} canEdit={false} onOpen={onOpen} />);

    await user.click(screen.getByText("Migrar el schema de auth"));

    expect(onOpen).toHaveBeenCalledWith("ticket-2");
  });

  it("hides the remove button when canEdit is false", () => {
    render(<RelationBadge relation={buildRelation()} canEdit={false} onOpen={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /quitar/i })).not.toBeInTheDocument();
  });

  it("shows the remove button and calls onRemove when canEdit is true", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const relation = buildRelation();
    render(<RelationBadge relation={relation} canEdit onOpen={vi.fn()} onRemove={onRemove} />);

    await user.click(screen.getByRole("button", { name: /quitar/i }));

    expect(onRemove).toHaveBeenCalledWith(relation);
  });
});
