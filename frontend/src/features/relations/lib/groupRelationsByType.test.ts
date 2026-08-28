import { describe, expect, it } from "vitest";

import { groupRelationsByType } from "@/features/relations/lib/groupRelationsByType";
import type { TicketRelation } from "@/features/relations/types/relation.types";

function buildRelation(overrides: Partial<TicketRelation> = {}): TicketRelation {
  return {
    id: "relation-1",
    relation_type: "relates_to",
    stored_type: "relates_to",
    direction: "outgoing",
    ticket: {
      id: "ticket-other",
      title: "Otro ticket",
      reference: "TASK-2",
      priority: "medium",
      column_name: "Backlog",
    },
    created_at: "2026-08-27T10:00:00Z",
    ...overrides,
  };
}

describe("groupRelationsByType", () => {
  it("returns an empty array for no relations", () => {
    expect(groupRelationsByType([])).toEqual([]);
  });

  it("groups by resolved type", () => {
    const relations = [
      buildRelation({ id: "r1", relation_type: "blocks" }),
      buildRelation({ id: "r2", relation_type: "relates_to" }),
      buildRelation({ id: "r3", relation_type: "blocks" }),
    ];

    const groups = groupRelationsByType(relations);

    const blocksGroup = groups.find((group) => group.type === "blocks");
    expect(blocksGroup?.relations.map((relation) => relation.id)).toEqual(["r1", "r3"]);
  });

  it("keeps a stable group order (blocked_by, blocks, relates_to, duplicate_of, duplicated_by)", () => {
    const relations = [
      buildRelation({ id: "r1", relation_type: "duplicated_by" }),
      buildRelation({ id: "r2", relation_type: "blocked_by" }),
      buildRelation({ id: "r3", relation_type: "duplicate_of" }),
      buildRelation({ id: "r4", relation_type: "blocks" }),
      buildRelation({ id: "r5", relation_type: "relates_to" }),
    ];

    const groups = groupRelationsByType(relations);

    expect(groups.map((group) => group.type)).toEqual([
      "blocked_by",
      "blocks",
      "relates_to",
      "duplicate_of",
      "duplicated_by",
    ]);
  });

  it("preserves the received order inside each group", () => {
    const relations = [
      buildRelation({ id: "r1", relation_type: "relates_to" }),
      buildRelation({ id: "r2", relation_type: "blocks" }),
      buildRelation({ id: "r3", relation_type: "relates_to" }),
      buildRelation({ id: "r4", relation_type: "relates_to" }),
    ];

    const groups = groupRelationsByType(relations);

    const relatesToGroup = groups.find((group) => group.type === "relates_to");
    expect(relatesToGroup?.relations.map((relation) => relation.id)).toEqual(["r1", "r3", "r4"]);
  });
});
