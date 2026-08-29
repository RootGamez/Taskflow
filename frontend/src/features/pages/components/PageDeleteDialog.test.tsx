import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PageDeleteDialog } from "@/features/pages/components/PageDeleteDialog";

describe("PageDeleteDialog", () => {
  it("shows the descendant count", () => {
    render(
      <PageDeleteDialog
        isOpen
        onOpenChange={vi.fn()}
        pageTitle="Onboarding"
        descendantCount={3}
        isDeleting={false}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText(/3 sub-páginas/i)).toBeInTheDocument();
  });

  it("keeps confirm disabled until the title matches", async () => {
    const user = userEvent.setup();
    render(
      <PageDeleteDialog
        isOpen
        onOpenChange={vi.fn()}
        pageTitle="Onboarding"
        descendantCount={0}
        isDeleting={false}
        onConfirm={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /eliminar página/i });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/confirmación de eliminación/i), "Onboarding");

    expect(confirmButton).toBeEnabled();
  });
});
