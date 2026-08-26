import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateLabelInline } from "@/features/labels/components/CreateLabelInline";
import { LABEL_COLORS } from "@/features/labels/lib/labelPalette";

describe("CreateLabelInline", () => {
  it("renderiza un swatch por cada color de la paleta", () => {
    render(<CreateLabelInline onSubmit={vi.fn()} />);

    const swatches = screen.getAllByRole("button", { name: /Usar color/ });
    expect(swatches).toHaveLength(LABEL_COLORS.length);
  });

  it("deshabilita el submit con el nombre vacio", () => {
    render(<CreateLabelInline onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
  });

  it("envia el nombre y el color seleccionado", () => {
    const onSubmit = vi.fn();
    render(<CreateLabelInline onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Nombre del label"), { target: { value: "Bug" } });
    fireEvent.click(screen.getByRole("button", { name: `Usar color ${LABEL_COLORS[2]}` }));
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(onSubmit).toHaveBeenCalledWith({ name: "Bug", color: LABEL_COLORS[2] });
  });

  it("llama a onCancel al hacer click en Cancelar", () => {
    const onCancel = vi.fn();
    render(<CreateLabelInline onSubmit={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onCancel).toHaveBeenCalled();
  });

  it("no renderiza el boton Cancelar cuando no se provee onCancel", () => {
    render(<CreateLabelInline onSubmit={vi.fn()} />);

    expect(screen.queryByText("Cancelar")).not.toBeInTheDocument();
  });

  it("deshabilita el input y los swatches mientras isSubmitting es true", () => {
    render(<CreateLabelInline onSubmit={vi.fn()} isSubmitting />);

    expect(screen.getByLabelText("Nombre del label")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Usar color ${LABEL_COLORS[0]}` })).toBeDisabled();
  });
});
