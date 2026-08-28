import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubtaskProgressBar } from "@/features/subtasks/components/SubtaskProgressBar";

describe("SubtaskProgressBar", () => {
  it('renderiza "3/7"', () => {
    render(<SubtaskProgressBar done={3} total={7} />);

    expect(screen.getByText("3/7")).toBeInTheDocument();
  });

  it("no renderiza nada cuando total es 0", () => {
    const { container } = render(<SubtaskProgressBar done={0} total={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("expone un role progressbar con el valor correcto", () => {
    render(<SubtaskProgressBar done={1} total={4} />);

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "25");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });
});
