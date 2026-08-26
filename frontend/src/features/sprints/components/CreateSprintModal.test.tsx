import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateSprintModal } from "@/features/sprints/components/CreateSprintModal";

describe("CreateSprintModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render its content when isOpen is false", () => {
    render(<CreateSprintModal isOpen={false} onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.queryByText("Nuevo sprint")).not.toBeInTheDocument();
  });

  it("disables the submit button until name and both dates are filled", async () => {
    const user = userEvent.setup();
    render(<CreateSprintModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Crear sprint" })).toBeDisabled();

    await user.type(screen.getByLabelText("Nombre"), "Sprint 12");
    expect(screen.getByRole("button", { name: "Crear sprint" })).toBeDisabled();

    await user.type(screen.getByLabelText("Inicio"), "2026-09-01");
    await user.type(screen.getByLabelText("Fin"), "2026-09-14");

    expect(screen.getByRole("button", { name: "Crear sprint" })).toBeEnabled();
  });

  it("calls onCreate with the trimmed name and the filled fields", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<CreateSprintModal isOpen onClose={vi.fn()} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("Nombre"), "  Sprint 12  ");
    await user.type(screen.getByLabelText("Inicio"), "2026-09-01");
    await user.type(screen.getByLabelText("Fin"), "2026-09-14");
    await user.click(screen.getByRole("button", { name: "Crear sprint" }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Sprint 12",
      start_date: "2026-09-01",
      end_date: "2026-09-14",
      goal: undefined,
    });
  });

  it("calls onClose when 'Cancelar' is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CreateSprintModal isOpen onClose={onClose} onCreate={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("resets the form fields every time it reopens", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CreateSprintModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    await user.type(screen.getByLabelText("Nombre"), "Sprint 12");
    rerender(<CreateSprintModal isOpen={false} onClose={vi.fn()} onCreate={vi.fn()} />);
    rerender(<CreateSprintModal isOpen onClose={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByLabelText("Nombre")).toHaveValue("");
  });
});
