import { describe, expect, it } from "vitest";

import { PRIORITY_STYLES, PRIORITY_ORDER } from "@/features/tickets/lib/priorityStyles";
import type { Priority } from "@/features/tickets/types/ticket.types";

const RAW_TAILWIND_COLOR_PATTERN = /-(red|orange|yellow|amber|blue|sky|zinc|slate|emerald)-\d{2,3}\b/;

const EXPECTED_LABELS: Record<Priority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  none: "Sin prioridad",
};

describe("priorityStyles", () => {
  it.each(PRIORITY_ORDER)("expone un label en espanol para la prioridad '%s'", (priority) => {
    expect(PRIORITY_STYLES[priority].label).toBe(EXPECTED_LABELS[priority]);
  });

  it.each(PRIORITY_ORDER)("expone un icono para la prioridad '%s'", (priority) => {
    expect(PRIORITY_STYLES[priority].Icon).toBeDefined();
    expect(typeof PRIORITY_STYLES[priority].Icon).toBe("object");
  });

  it.each(PRIORITY_ORDER)(
    "usa clases de token (no colores crudos de Tailwind) para '%s'",
    (priority) => {
      const style = PRIORITY_STYLES[priority];

      expect(style.textClass).not.toMatch(RAW_TAILWIND_COLOR_PATTERN);
      expect(style.bgClass).not.toMatch(RAW_TAILWIND_COLOR_PATTERN);
      expect(style.textClass).toMatch(/^text-priority-/);
      expect(style.bgClass).toMatch(/^bg-priority-/);
    },
  );

  it("cubre exhaustivamente las 5 prioridades definidas en el dominio", () => {
    expect(Object.keys(PRIORITY_STYLES).sort()).toEqual(
      ["urgent", "high", "medium", "low", "none"].sort(),
    );
  });
});
