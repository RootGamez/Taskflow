import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TicketDeleteDialog } from "@/features/tickets/components/TicketDeleteDialog";

function renderDialog(overrides: Partial<React.ComponentProps<typeof TicketDeleteDialog>> = {}) {
  const props: React.ComponentProps<typeof TicketDeleteDialog> = {
    isOpen: true,
    onOpenChange: vi.fn(),
    deleteKeyword: "Arreglar el login",
    deleteConfirmation: "",
    onDeleteConfirmationChange: vi.fn(),
    isDeleting: false,
    canConfirmDelete: false,
    onConfirm: vi.fn(),
    ...overrides,
  };

  return { ...render(<TicketDeleteDialog {...props} />), props };
}

describe("TicketDeleteDialog", () => {
  it("renderiza el titulo exacto del ticket como palabra de confirmacion", () => {
    renderDialog({ deleteKeyword: "Arreglar el login con Google" });

    expect(screen.getByText("Arreglar el login con Google")).toBeInTheDocument();
  });

  it("mantiene el boton de confirmar deshabilitado hasta que el titulo coincide", () => {
    const { rerender, props } = renderDialog({ canConfirmDelete: false });

    expect(screen.getByRole("button", { name: /eliminar ticket/i })).toBeDisabled();

    rerender(<TicketDeleteDialog {...props} canConfirmDelete deleteConfirmation={props.deleteKeyword} />);

    expect(screen.getByRole("button", { name: /eliminar ticket/i })).toBeEnabled();
  });

  it("llama a onConfirm cuando el titulo coincide y se hace click en confirmar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({
      canConfirmDelete: true,
      deleteConfirmation: "Arreglar el login",
      onConfirm,
    });

    await user.click(screen.getByRole("button", { name: /eliminar ticket/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('muestra "Eliminando..." mientras la eliminacion esta en curso', () => {
    renderDialog({ isDeleting: true, canConfirmDelete: true, deleteConfirmation: "Arreglar el login" });

    expect(screen.getByRole("button", { name: /eliminando/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminando/i })).toBeDisabled();
  });
});
