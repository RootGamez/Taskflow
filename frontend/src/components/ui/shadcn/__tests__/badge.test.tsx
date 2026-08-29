import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/shadcn/badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>Activo</Badge>);

    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("uses a solid 1.5px border matching the text color (the 'stamp' look)", () => {
    render(<Badge variant="primary">Sprint 12</Badge>);

    const badge = screen.getByText("Sprint 12");

    expect(badge.className).toContain("border-[1.5px]");
    expect(badge.className).toContain("border-primary");
    expect(badge.className).toContain("text-primary");
  });

  it("switches to tabular monospace figures when mono is set (for IDs like TASK-142)", () => {
    render(
      <Badge mono variant="secondary">
        TASK-142
      </Badge>,
    );

    const badge = screen.getByText("TASK-142");

    expect(badge.className).toContain("font-mono");
    expect(badge.className).toContain("tabular-nums");
  });

  it("rotates the urgent 'stamp' variant like an ink seal", () => {
    render(<Badge variant="stamp">Urgente</Badge>);

    const badge = screen.getByText("Urgente");

    expect(badge.className).toContain("-rotate-3");
    expect(badge.className).toContain("uppercase");
    expect(badge.className).toContain("border-destructive");
  });

  it("renders as the child element when asChild is set", () => {
    render(
      <Badge asChild variant="primary">
        <a href="/tickets/142">TASK-142</a>
      </Badge>,
    );

    expect(screen.getByRole("link", { name: "TASK-142" })).toHaveAttribute("href", "/tickets/142");
  });
});
