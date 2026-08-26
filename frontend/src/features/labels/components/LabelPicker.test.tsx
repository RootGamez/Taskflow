import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LabelPicker } from "@/features/labels/components/LabelPicker";
import type { Label } from "@/features/tickets/types/ticket.types";

function buildLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    project_id: "project-1",
    name: "Bug",
    color: "#DC2626",
    ...overrides,
  };
}

const LABELS: Label[] = [
  buildLabel({ id: "l1", name: "Bug" }),
  buildLabel({ id: "l2", name: "Feature" }),
  buildLabel({ id: "l3", name: "Urgente" }),
];

describe("LabelPicker", () => {
  it("renderiza un checkbox por cada label existente", () => {
    render(
      <LabelPicker labels={LABELS} selectedLabelIds={[]} onChange={vi.fn()} canEdit />,
    );

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("marca como seleccionados los labels actuales del ticket", () => {
    render(
      <LabelPicker labels={LABELS} selectedLabelIds={["l2"]} onChange={vi.fn()} canEdit />,
    );

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    const featureCheckbox = checkboxes[LABELS.findIndex((l) => l.id === "l2")];
    expect(featureCheckbox.checked).toBe(true);

    const bugCheckbox = checkboxes[LABELS.findIndex((l) => l.id === "l1")];
    expect(bugCheckbox.checked).toBe(false);
  });

  it("llama a onChange con el nuevo set de ids al togglear", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker labels={LABELS} selectedLabelIds={["l1"]} onChange={onChange} canEdit />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[LABELS.findIndex((l) => l.id === "l2")]);

    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(["l1", "l2"]));
    expect(onChange.mock.calls[0][0]).toHaveLength(2);
  });

  it("llama a onChange sin el id al destildar un label ya seleccionado", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker labels={LABELS} selectedLabelIds={["l1", "l2"]} onChange={onChange} canEdit />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[LABELS.findIndex((l) => l.id === "l1")]);

    expect(onChange).toHaveBeenCalledWith(["l2"]);
  });

  it("no togglea cuando canEdit es false", () => {
    const onChange = vi.fn();
    render(
      <LabelPicker labels={LABELS} selectedLabelIds={[]} onChange={onChange} canEdit={false} />,
    );

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renderiza "+ Crear label" al final', () => {
    render(
      <LabelPicker labels={LABELS} selectedLabelIds={[]} onChange={vi.fn()} canEdit />,
    );

    expect(screen.getByText("+ Crear label")).toBeInTheDocument();
  });

  it("oculta las acciones de crear/borrar cuando canEdit es false", () => {
    render(
      <LabelPicker
        labels={LABELS}
        selectedLabelIds={[]}
        onChange={vi.fn()}
        canEdit={false}
        onDeleteLabel={vi.fn()}
      />,
    );

    expect(screen.queryByText("+ Crear label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Eliminar label/)).not.toBeInTheDocument();
  });

  it("muestra el estado vacio cuando el proyecto no tiene labels", () => {
    render(<LabelPicker labels={[]} selectedLabelIds={[]} onChange={vi.fn()} canEdit />);

    expect(screen.getByText("Este proyecto no tiene labels todavia.")).toBeInTheDocument();
  });

  it("pide confirmacion antes de llamar a onDeleteLabel", () => {
    const onDeleteLabel = vi.fn();
    render(
      <LabelPicker
        labels={LABELS}
        selectedLabelIds={[]}
        onChange={vi.fn()}
        canEdit
        onDeleteLabel={onDeleteLabel}
      />,
    );

    fireEvent.click(screen.getByLabelText("Eliminar label Bug"));
    expect(onDeleteLabel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Si"));
    expect(onDeleteLabel).toHaveBeenCalledWith("l1");
  });

  it('cancela el borrado al hacer click en "No"', () => {
    const onDeleteLabel = vi.fn();
    render(
      <LabelPicker
        labels={LABELS}
        selectedLabelIds={[]}
        onChange={vi.fn()}
        canEdit
        onDeleteLabel={onDeleteLabel}
      />,
    );

    fireEvent.click(screen.getByLabelText("Eliminar label Bug"));
    fireEvent.click(screen.getByText("No"));

    expect(onDeleteLabel).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Eliminar label Bug")).toBeInTheDocument();
  });

  it('muestra el formulario de creacion y llama a onCreateLabel al enviar', () => {
    const onCreateLabel = vi.fn();
    render(
      <LabelPicker
        labels={LABELS}
        selectedLabelIds={[]}
        onChange={vi.fn()}
        canEdit
        onCreateLabel={onCreateLabel}
      />,
    );

    fireEvent.click(screen.getByText("+ Crear label"));
    fireEvent.change(screen.getByLabelText("Nombre del label"), { target: { value: "Nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    expect(onCreateLabel).toHaveBeenCalledWith(expect.objectContaining({ name: "Nuevo" }));
    // Vuelve al boton "+ Crear label" despues de enviar
    expect(screen.getByText("+ Crear label")).toBeInTheDocument();
  });
});
