import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LabelChip } from "@/features/labels/components/LabelChip";
import type { Label } from "@/features/tickets/types/ticket.types";

function buildLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    project_id: "project-1",
    name: "Bug",
    color: "#DC2626",
    ...overrides,
  };
}

describe("LabelChip", () => {
  it("muestra el nombre del label", () => {
    render(<LabelChip label={buildLabel({ name: "Bug" })} />);

    expect(screen.getByText("Bug")).toBeInTheDocument();
  });

  it("aplica el estilo compartido del chip", () => {
    const label = buildLabel({ color: "#DC2626" });
    render(<LabelChip label={label} />);

    const chip = screen.getByText("Bug");
    // jsdom normaliza `#DC2626` a `rgb(220, 38, 38)` al leer `element.style`,
    // asi que comparamos contra el color solido en formato rgb en vez del
    // hex crudo que devuelve `getLabelChipStyle`.
    expect(chip.style.color).toBe("rgb(220, 38, 38)");
    expect(chip.style.backgroundColor).not.toBe("");
  });

  it("no renderiza nada para un label sin nombre", () => {
    const { container } = render(<LabelChip label={buildLabel({ name: "" })} />);

    expect(container).toBeEmptyDOMElement();
  });
});
