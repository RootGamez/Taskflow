import { describe, expect, it } from "vitest";

import { LABEL_COLORS } from "@/features/labels/lib/labelPalette";

describe("LABEL_COLORS", () => {
  it("expone exactamente 10 colores hex unicos en mayusculas", () => {
    expect(LABEL_COLORS).toHaveLength(10);
    expect(new Set(LABEL_COLORS).size).toBe(10);

    for (const color of LABEL_COLORS) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
      expect(color).toBe(color.toUpperCase());
    }
  });
});
