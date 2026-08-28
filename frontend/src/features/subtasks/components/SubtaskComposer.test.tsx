import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SubtaskComposer } from "@/features/subtasks/components/SubtaskComposer";

describe("SubtaskComposer", () => {
  it("el submit esta deshabilitado con el titulo vacio", () => {
    render(<SubtaskComposer onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /agregar/i })).toBeDisabled();
  });

  it("recorta los espacios antes de enviar", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<SubtaskComposer onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/agregar subtarea/i), "  Escribir tests  ");
    await user.click(screen.getByRole("button", { name: /agregar/i }));

    expect(onSubmit).toHaveBeenCalledWith("Escribir tests");
  });

  it("limpia el input despues de un submit exitoso", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<SubtaskComposer onSubmit={onSubmit} />);

    const input = screen.getByPlaceholderText(/agregar subtarea/i) as HTMLInputElement;
    await user.type(input, "Nueva subtarea");
    await user.click(screen.getByRole("button", { name: /agregar/i }));

    expect(input.value).toBe("");
  });

  it("envia al presionar Enter", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<SubtaskComposer onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText(/agregar subtarea/i), "Otra subtarea{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("Otra subtarea");
  });
});
