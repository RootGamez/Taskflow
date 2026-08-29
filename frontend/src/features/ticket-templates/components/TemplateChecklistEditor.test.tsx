import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateChecklistEditor } from "@/features/ticket-templates/components/TemplateChecklistEditor";

describe("TemplateChecklistEditor", () => {
  it("renderiza un input por item", () => {
    render(<TemplateChecklistEditor items={["Uno", "Dos", "Tres"]} onChange={() => {}} />);

    expect(screen.getByDisplayValue("Uno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dos")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tres")).toBeInTheDocument();
  });

  it("agrega un item al presionar Enter", () => {
    const handleChange = vi.fn();
    render(<TemplateChecklistEditor items={["Uno"]} onChange={handleChange} />);

    const composer = screen.getByLabelText("Agregar item del checklist");
    fireEvent.change(composer, { target: { value: "Dos" } });
    fireEvent.keyDown(composer, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith(["Uno", "Dos"]);
  });

  it("elimina un item al hacer click en el tacho", () => {
    const handleChange = vi.fn();
    render(<TemplateChecklistEditor items={["Uno", "Dos"]} onChange={handleChange} />);

    fireEvent.click(screen.getByLabelText("Eliminar item 1"));

    expect(handleChange).toHaveBeenCalledWith(["Dos"]);
  });

  it("edita el texto de un item existente", () => {
    const handleChange = vi.fn();
    render(<TemplateChecklistEditor items={["Uno", "Dos"]} onChange={handleChange} />);

    fireEvent.change(screen.getByLabelText("Item 1"), { target: { value: "Uno editado" } });

    expect(handleChange).toHaveBeenCalledWith(["Uno editado", "Dos"]);
  });

  it("borra el ultimo item con Backspace en el composer vacio", () => {
    const handleChange = vi.fn();
    render(<TemplateChecklistEditor items={["Uno", "Dos"]} onChange={handleChange} />);

    fireEvent.keyDown(screen.getByLabelText("Agregar item del checklist"), { key: "Backspace" });

    expect(handleChange).toHaveBeenCalledWith(["Uno"]);
  });

  it("recorta y descarta items en blanco al agregarlos", () => {
    const handleChange = vi.fn();
    render(<TemplateChecklistEditor items={[]} onChange={handleChange} />);

    const composer = screen.getByLabelText("Agregar item del checklist");

    fireEvent.change(composer, { target: { value: "   " } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(handleChange).not.toHaveBeenCalled();

    fireEvent.change(composer, { target: { value: "  con espacios  " } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(handleChange).toHaveBeenCalledWith(["con espacios"]);
  });
});
