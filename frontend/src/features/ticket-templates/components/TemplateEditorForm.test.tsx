import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateEditorForm } from "@/features/ticket-templates/components/TemplateEditorForm";

describe("TemplateEditorForm", () => {
  it("mantiene el submit deshabilitado con el nombre vacio", () => {
    render(<TemplateEditorForm onSubmit={() => {}} />);

    expect(screen.getByRole("button", { name: /crear plantilla/i })).toBeDisabled();
  });

  it("envia name, title_template, priority e items", () => {
    const handleSubmit = vi.fn();
    render(<TemplateEditorForm onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Bug report" } });
    fireEvent.change(screen.getByLabelText("Prefijo del titulo"), { target: { value: "[BUG] " } });
    fireEvent.change(screen.getByLabelText("Prioridad"), { target: { value: "high" } });

    const composer = screen.getByLabelText("Agregar item del checklist");
    fireEvent.change(composer, { target: { value: "Paso 1" } });
    fireEvent.keyDown(composer, { key: "Enter" });

    fireEvent.click(screen.getByRole("button", { name: /crear plantilla/i }));

    expect(handleSubmit).toHaveBeenCalledWith({
      name: "Bug report",
      title_template: "[BUG] ",
      priority: "high",
      items: ["Paso 1"],
    });
  });

  it('muestra "Guardando..." mientras isSubmitting es true', () => {
    render(<TemplateEditorForm onSubmit={() => {}} isSubmitting initialTemplate={null} />);

    expect(screen.getByRole("button", { name: /guardando/i })).toBeInTheDocument();
  });

  it('muestra "Guardar cambios" cuando edita una plantilla existente', () => {
    render(
      <TemplateEditorForm
        onSubmit={() => {}}
        initialTemplate={{
          id: "t1",
          project_id: "project-1",
          name: "Bug report",
          title_template: "",
          description: "",
          priority: "none",
          items: [{ id: "item-1", title: "Paso 1", order: 1 }],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
  });

  it("muestra el error de nombre duplicado", () => {
    render(
      <TemplateEditorForm
        onSubmit={() => {}}
        errorMessage="Ya existe una plantilla con ese nombre en este proyecto."
      />,
    );

    expect(screen.getByText("Ya existe una plantilla con ese nombre en este proyecto.")).toBeInTheDocument();
  });
});
