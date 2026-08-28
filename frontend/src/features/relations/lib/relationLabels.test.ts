import { describe, expect, it } from "vitest";

import {
  RELATION_TYPE_ORDER,
  getRelationTypeStyle,
} from "@/features/relations/lib/relationLabels";
import type { RelationType } from "@/features/relations/types/relation.types";

describe("getRelationTypeStyle", () => {
  it("maps each of the 5 resolved types to a Spanish label", () => {
    const expectedLabels: Record<RelationType, string> = {
      blocked_by: "Bloqueado por",
      blocks: "Bloquea a",
      relates_to: "Relacionado con",
      duplicate_of: "Duplicado de",
      duplicated_by: "Duplicado por",
    };

    for (const type of RELATION_TYPE_ORDER) {
      expect(getRelationTypeStyle(type).label).toBe(expectedLabels[type]);
    }
  });

  it("maps each type to an icon and a tone", () => {
    for (const type of RELATION_TYPE_ORDER) {
      const style = getRelationTypeStyle(type);
      expect(style.Icon).toBeDefined();
      expect(style.toneClass).toEqual(expect.stringContaining("bg-"));
      expect(style.toneClass).toEqual(expect.stringContaining("text-"));
    }
  });

  it("falls back safely for an unknown type", () => {
    const style = getRelationTypeStyle("not-a-real-type");

    expect(style.label).toBeTruthy();
    expect(style.Icon).toBeDefined();
    expect(style.toneClass).toEqual(expect.stringContaining("bg-"));
  });
});
