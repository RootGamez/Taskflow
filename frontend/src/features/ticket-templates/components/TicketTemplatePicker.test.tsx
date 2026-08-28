import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TicketTemplatePicker } from "@/features/ticket-templates/components/TicketTemplatePicker";
import * as useTicketTemplatesHooks from "@/features/ticket-templates/hooks/useTicketTemplates";
import type { TicketTemplate } from "@/features/ticket-templates/types/ticketTemplate.types";

vi.mock("@/features/ticket-templates/hooks/useTicketTemplates");

function buildTemplate(overrides: Partial<TicketTemplate> = {}): TicketTemplate {
  return {
    id: "template-1",
    project_id: "project-1",
    name: "Bug report",
    title_template: "[BUG] ",
    description: "",
    priority: "high",
    items: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockHooks(templates: TicketTemplate[] = []) {
  vi.mocked(useTicketTemplatesHooks.useTicketTemplates).mockReturnValue({
    data: templates,
  } as ReturnType<typeof useTicketTemplatesHooks.useTicketTemplates>);
  vi.mocked(useTicketTemplatesHooks.useCreateTicketTemplate).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useTicketTemplatesHooks.useCreateTicketTemplate>);
  vi.mocked(useTicketTemplatesHooks.useUpdateTicketTemplate).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useTicketTemplatesHooks.useUpdateTicketTemplate>);
  vi.mocked(useTicketTemplatesHooks.useDeleteTicketTemplate).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useTicketTemplatesHooks.useDeleteTicketTemplate>);
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /usar plantilla/i }));
}

describe("TicketTemplatePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("siempre renderiza la plantilla built-in primero", () => {
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" }), buildTemplate({ id: "t2", name: "Feature" })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={() => {}} />);
    openPicker();

    const options = screen.getAllByTestId("template-option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("Plantilla por defecto");
    expect(options[1]).toHaveTextContent("Bug report");
    expect(options[2]).toHaveTextContent("Feature");
  });

  it("renderiza las plantillas del proyecto despues de la built-in", () => {
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={() => {}} />);
    openPicker();

    expect(screen.getByText("Bug report")).toBeInTheDocument();
  });

  it('renderiza "Administrar plantillas"', () => {
    mockHooks([]);

    render(<TicketTemplatePicker projectId="project-1" onApply={() => {}} />);
    openPicker();

    expect(screen.getByRole("button", { name: /administrar plantillas/i })).toBeInTheDocument();
  });

  it("llama a onApply con la plantilla seleccionada", () => {
    const handleApply = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report", title_template: "[BUG] " })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={handleApply} />);
    openPicker();

    fireEvent.click(screen.getByText("Bug report"));

    expect(handleApply).toHaveBeenCalledWith({
      id: "t1",
      title_template: "[BUG] ",
      description: "",
      priority: "high",
    });
  });

  it("pide confirmacion cuando el titulo no esta vacio", () => {
    const handleApply = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={handleApply} currentTitle="Ya escribi algo" />);
    openPicker();

    fireEvent.click(screen.getByText("Bug report"));

    expect(handleApply).not.toHaveBeenCalled();
    expect(screen.getByText(/reemplazar con esta plantilla/i)).toBeInTheDocument();
  });

  it("no pide confirmacion en un borrador pristino", () => {
    const handleApply = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={handleApply} currentTitle="" />);
    openPicker();

    fireEvent.click(screen.getByText("Bug report"));

    expect(handleApply).toHaveBeenCalledTimes(1);
  });

  it("aplica la plantilla igual al confirmar", () => {
    const handleApply = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={handleApply} currentTitle="Ya escribi algo" />);
    openPicker();
    fireEvent.click(screen.getByText("Bug report"));

    fireEvent.click(screen.getByRole("button", { name: /aplicar igual/i }));

    expect(handleApply).toHaveBeenCalledTimes(1);
  });

  it("cancela la confirmacion y vuelve a la lista", () => {
    const handleApply = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);

    render(<TicketTemplatePicker projectId="project-1" onApply={handleApply} currentTitle="Ya escribi algo" />);
    openPicker();
    fireEvent.click(screen.getByText("Bug report"));

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(handleApply).not.toHaveBeenCalled();
    expect(screen.getByText("Bug report")).toBeInTheDocument();
  });

  it('abre "Administrar plantillas" al hacer click', () => {
    mockHooks([]);

    render(<TicketTemplatePicker projectId="project-1" onApply={() => {}} />);
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: /administrar plantillas/i }));

    expect(screen.getByRole("heading", { name: /administrar plantillas/i })).toBeInTheDocument();
  });

  it("se deshabilita cuando el modal esta cargando", () => {
    mockHooks([]);

    render(<TicketTemplatePicker projectId="project-1" onApply={() => {}} disabled />);

    expect(screen.getByRole("button", { name: /usar plantilla/i })).toBeDisabled();
  });
});
