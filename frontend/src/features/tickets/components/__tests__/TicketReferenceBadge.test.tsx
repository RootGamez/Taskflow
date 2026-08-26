import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TicketReferenceBadge } from "@/features/tickets/components/TicketReferenceBadge";

describe("TicketReferenceBadge", () => {
  it("renderiza TASK-142 en una clase monoespaciada", () => {
    render(<TicketReferenceBadge reference="TASK-142" />);

    const badge = screen.getByText("TASK-142");
    expect(badge.className).toMatch(/font-mono/);
  });

  it("no renderiza nada cuando reference es null", () => {
    const { container } = render(<TicketReferenceBadge reference={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("no renderiza nada cuando reference es undefined", () => {
    const { container } = render(<TicketReferenceBadge reference={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
