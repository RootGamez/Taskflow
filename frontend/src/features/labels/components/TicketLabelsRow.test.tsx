import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import * as labelsApi from "@/features/labels/api/labelsApi";
import { TicketLabelsRow } from "@/features/labels/components/TicketLabelsRow";
import * as ticketsApi from "@/features/tickets/api/ticketsApi";
import type { Label, Ticket } from "@/features/tickets/types/ticket.types";

// jsdom no implementa ResizeObserver, y @radix-ui/react-popper (usado por
// PopoverContent) lo necesita para posicionar el contenido. Polyfill
// acotado a este archivo (no toca src/test/setup.ts, compartido).
beforeAll(() => {
  if (typeof window.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

function buildLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: "label-1",
    project_id: "project-1",
    name: "Bug",
    color: "#DC2626",
    ...overrides,
  };
}

function buildFakeTicketResponse(): Ticket {
  return { id: "ticket-1", project_id: "project-1" } as unknown as Ticket;
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe("TicketLabelsRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra los labels actuales del ticket como chips", async () => {
    vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([buildLabel({ id: "label-1", name: "Bug" })]);

    render(
      <TicketLabelsRow
        ticketId="ticket-1"
        projectId="project-1"
        labels={[buildLabel({ id: "label-1", name: "Bug" })]}
        canEdit
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Bug")).toBeInTheDocument();
  });

  it("abre el popover y muestra los labels del proyecto al hacer click en el trigger", async () => {
    const user = userEvent.setup();
    vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([
      buildLabel({ id: "label-1", name: "Bug" }),
      buildLabel({ id: "label-2", name: "Feature" }),
    ]);

    render(<TicketLabelsRow ticketId="ticket-1" projectId="project-1" labels={[]} canEdit />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: "Editar labels" }));

    expect(await screen.findByText("Feature")).toBeInTheDocument();
  });

  it("llama a updateTicket con label_ids al togglear un label en el popover", async () => {
    const user = userEvent.setup();
    vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([buildLabel({ id: "label-2", name: "Feature" })]);
    const updateSpy = vi
      .spyOn(ticketsApi, "updateTicket")
      .mockResolvedValue(buildFakeTicketResponse());

    render(<TicketLabelsRow ticketId="ticket-1" projectId="project-1" labels={[]} canEdit />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: "Editar labels" }));
    const checkbox = await screen.findByRole("checkbox");
    await user.click(checkbox);

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith("project-1", "ticket-1", { label_ids: ["label-2"] }),
    );
  });

  it("llama a createLabel al enviar el formulario de creacion desde el popover", async () => {
    const user = userEvent.setup();
    vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([]);
    const createSpy = vi
      .spyOn(labelsApi, "createLabel")
      .mockResolvedValue(buildLabel({ id: "label-new", name: "Nuevo" }));

    render(<TicketLabelsRow ticketId="ticket-1" projectId="project-1" labels={[]} canEdit />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: "Editar labels" }));
    await user.click(await screen.findByText("+ Crear label"));
    await user.type(screen.getByLabelText("Nombre del label"), "Nuevo");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith("project-1", expect.objectContaining({ name: "Nuevo" })),
    );
  });

  it("llama a deleteLabel al confirmar el borrado desde el popover", async () => {
    const user = userEvent.setup();
    vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([buildLabel({ id: "label-1", name: "Bug" })]);
    const deleteSpy = vi.spyOn(labelsApi, "deleteLabel").mockResolvedValue(undefined);

    render(<TicketLabelsRow ticketId="ticket-1" projectId="project-1" labels={[]} canEdit />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("button", { name: "Editar labels" }));
    await user.click(await screen.findByLabelText("Eliminar label Bug"));
    await user.click(screen.getByText("Si"));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith("project-1", "label-1"));
  });

  it("no muestra el trigger de edicion cuando canEdit es false", () => {
    vi.spyOn(labelsApi, "getLabelsByProject").mockResolvedValue([]);

    render(<TicketLabelsRow ticketId="ticket-1" projectId="project-1" labels={[]} canEdit={false} />, {
      wrapper: createWrapper(),
    });

    expect(screen.queryByRole("button", { name: "Editar labels" })).not.toBeInTheDocument();
    expect(screen.getByText("Sin labels")).toBeInTheDocument();
  });
});
