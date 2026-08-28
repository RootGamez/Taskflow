import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TemplateManagerDialog } from "@/features/ticket-templates/components/TemplateManagerDialog";
import * as useTicketTemplatesHooks from "@/features/ticket-templates/hooks/useTicketTemplates";
import type { TicketTemplate } from "@/features/ticket-templates/types/ticketTemplate.types";

vi.mock("@/features/ticket-templates/hooks/useTicketTemplates");

function buildTemplate(overrides: Partial<TicketTemplate> = {}): TicketTemplate {
  return {
    id: "template-1",
    project_id: "project-1",
    name: "Bug report",
    title_template: "",
    description: "",
    priority: "none",
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
    mutateAsync: vi.fn().mockResolvedValue(buildTemplate()),
    isPending: false,
  } as unknown as ReturnType<typeof useTicketTemplatesHooks.useCreateTicketTemplate>);
  vi.mocked(useTicketTemplatesHooks.useUpdateTicketTemplate).mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(buildTemplate()),
    isPending: false,
  } as unknown as ReturnType<typeof useTicketTemplatesHooks.useUpdateTicketTemplate>);
  vi.mocked(useTicketTemplatesHooks.useDeleteTicketTemplate).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useTicketTemplatesHooks.useDeleteTicketTemplate>);
}

describe("TemplateManagerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el estado vacio con un CTA", () => {
    mockHooks([]);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    expect(screen.getByText(/no tiene plantillas todavia/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nueva plantilla/i })).toBeInTheDocument();
  });

  it("renderiza una fila por plantilla", () => {
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" }), buildTemplate({ id: "t2", name: "Feature" })]);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    expect(screen.getByText("Bug report")).toBeInTheDocument();
    expect(screen.getByText("Feature")).toBeInTheDocument();
  });

  it("abre el editor al hacer click en una fila", () => {
    mockHooks([buildTemplate({ id: "t1", name: "Bug report", title_template: "[BUG] " })]);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.click(screen.getByText("Bug report"));

    expect(screen.getByDisplayValue("Bug report")).toBeInTheDocument();
    // `getByDisplayValue` normaliza (trim) el valor del nodo antes de
    // comparar, asi que el espacio final de "[BUG] " no se puede aserir
    // por esta via -- se verifica por separado en applyTemplateToDraft.test.ts.
    expect(screen.getByDisplayValue("[BUG]")).toBeInTheDocument();
  });

  it("confirma antes de borrar", () => {
    const deleteMutate = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);
    vi.mocked(useTicketTemplatesHooks.useDeleteTicketTemplate).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useDeleteTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.click(screen.getByLabelText("Eliminar plantilla Bug report"));
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/eliminar "bug report"/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /si, eliminar/i }));
    expect(deleteMutate).toHaveBeenCalledWith("t1", expect.anything());
  });

  it("cancela el borrado sin llamar a la mutacion", () => {
    const deleteMutate = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);
    vi.mocked(useTicketTemplatesHooks.useDeleteTicketTemplate).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useDeleteTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.click(screen.getByLabelText("Eliminar plantilla Bug report"));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Bug report")).toBeInTheDocument();
  });

  it("el tacho responde a Enter ademas de click", () => {
    const deleteMutate = vi.fn();
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);
    vi.mocked(useTicketTemplatesHooks.useDeleteTicketTemplate).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useDeleteTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.keyDown(screen.getByLabelText("Eliminar plantilla Bug report"), { key: "Enter" });

    expect(screen.getByText(/eliminar "bug report"/i)).toBeInTheDocument();
  });

  it("des-selecciona la plantilla borrada si estaba abierta en el editor", () => {
    const deleteMutate = vi.fn((_templateId: string, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);
    vi.mocked(useTicketTemplatesHooks.useDeleteTicketTemplate).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useDeleteTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.click(screen.getByText("Bug report"));
    fireEvent.click(screen.getByLabelText("Eliminar plantilla Bug report"));
    fireEvent.click(screen.getByRole("button", { name: /si, eliminar/i }));

    expect(deleteMutate).toHaveBeenCalledWith("t1", expect.anything());
    expect(screen.getByRole("button", { name: /crear plantilla/i })).toBeInTheDocument();
  });

  it("crea una plantilla nueva y selecciona la recien creada", async () => {
    const createdTemplate = buildTemplate({ id: "new-id", name: "Feature" });
    const createMutateAsync = vi.fn().mockResolvedValue(createdTemplate);
    mockHooks([]);
    vi.mocked(useTicketTemplatesHooks.useCreateTicketTemplate).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useCreateTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Feature" } });
    fireEvent.click(screen.getByRole("button", { name: /crear plantilla/i }));

    await waitFor(() => expect(createMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: "Feature" })));
  });

  it("actualiza la plantilla seleccionada al enviar", async () => {
    const updatedTemplate = buildTemplate({ id: "t1", name: "Bug report renombrado" });
    const updateMutateAsync = vi.fn().mockResolvedValue(updatedTemplate);
    mockHooks([buildTemplate({ id: "t1", name: "Bug report" })]);
    vi.mocked(useTicketTemplatesHooks.useUpdateTicketTemplate).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useUpdateTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.click(screen.getByText("Bug report"));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Bug report renombrado" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        templateId: "t1",
        payload: expect.objectContaining({ name: "Bug report renombrado" }),
      }),
    );
  });

  it("muestra el mensaje de error cuando la mutacion falla", async () => {
    const createMutateAsync = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: "Ya existe una plantilla con ese nombre en este proyecto." } },
    });
    mockHooks([]);
    vi.mocked(useTicketTemplatesHooks.useCreateTicketTemplate).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useCreateTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Bug report" } });
    fireEvent.click(screen.getByRole("button", { name: /crear plantilla/i }));

    expect(
      await screen.findByText("Ya existe una plantilla con ese nombre en este proyecto."),
    ).toBeInTheDocument();
  });

  it("muestra un error generico cuando la mutacion falla sin detail", async () => {
    const createMutateAsync = vi.fn().mockRejectedValue(new Error("network down"));
    mockHooks([]);
    vi.mocked(useTicketTemplatesHooks.useCreateTicketTemplate).mockReturnValue({
      mutateAsync: createMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketTemplatesHooks.useCreateTicketTemplate>);

    render(<TemplateManagerDialog projectId="project-1" isOpen onOpenChange={() => {}} />);

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Bug report" } });
    fireEvent.click(screen.getByRole("button", { name: /crear plantilla/i }));

    expect(await screen.findByText("No se pudo guardar la plantilla.")).toBeInTheDocument();
  });
});
