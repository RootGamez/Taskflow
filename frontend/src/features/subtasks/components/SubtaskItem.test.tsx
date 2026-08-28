import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SubtaskItem } from "@/features/subtasks/components/SubtaskItem";
import type { SubTask } from "@/features/subtasks/types/subtask.types";

function buildSubtask(overrides: Partial<SubTask> = {}): SubTask {
  return {
    id: "subtask-1",
    ticket_id: "ticket-1",
    title: "Escribir los tests",
    is_done: false,
    order: 1,
    assignee: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SubtaskItem", () => {
  it("renderiza el titulo", () => {
    render(
      <SubtaskItem
        subtask={buildSubtask({ title: "Revisar el PR" })}
        canEdit
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Revisar el PR")).toBeInTheDocument();
  });

  it("renderiza el checkbox marcado cuando is_done es true", () => {
    render(
      <SubtaskItem subtask={buildSubtask({ is_done: true })} canEdit onToggle={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("aplica el estilo line-through cuando esta hecha", () => {
    render(
      <SubtaskItem subtask={buildSubtask({ is_done: true })} canEdit onToggle={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText("Escribir los tests").className).toMatch(/line-through/);
  });

  it("llama a onToggle con el valor invertido", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <SubtaskItem subtask={buildSubtask({ is_done: false })} canEdit onToggle={onToggle} onDelete={vi.fn()} />,
    );

    await user.click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("oculta el boton de borrar cuando canEdit es false", () => {
    render(
      <SubtaskItem subtask={buildSubtask()} canEdit={false} onToggle={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.queryByRole("button", { name: /eliminar subtarea/i })).not.toBeInTheDocument();
  });
});
