import { describe, expect, it } from "vitest";

import { getLabelChipStyle } from "@/features/labels/lib/labelStyles";

describe("getLabelChipStyle", () => {
  it("construye un fondo con 15% de alfa a partir del color solido", () => {
    const style = getLabelChipStyle("#DC2626");

    expect(style.backgroundColor).toBe("#DC262626");
  });

  it("usa el color solido como color de texto", () => {
    const style = getLabelChipStyle("#DC2626");

    expect(style.color).toBe("#DC2626");
  });

  it("maneja hex en minusculas sin romperse", () => {
    const style = getLabelChipStyle("#dc2626");

    expect(style.backgroundColor).toBe("#dc262626");
    expect(style.color).toBe("#dc2626");
    expect(style.borderColor).toBe("#dc262640");
  });
});
