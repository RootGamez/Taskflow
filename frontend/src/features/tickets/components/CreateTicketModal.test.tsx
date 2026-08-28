import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CreateTicketModal } from "@/features/tickets/components/CreateTicketModal";
import { BUILT_IN_TEMPLATE_ID } from "@/features/ticket-templates/lib/builtInTemplate";

// Smoke test de WP-0A (docs/PHASE_4_PLAN.md seccion 3.6, test 10): no
// esta cubierto por el umbral de `vitest.config.ts` (CreateTicketModal.tsx
// nunca estuvo en `COVERED_PATHS`), pero es la garantia de que mover
// `DEFAULT_DESCRIPTION` a `defaultTicketTemplate.ts` (R0A-2) no rompio el
// contenido con el que el modal precarga el editor al abrirse.

vi.mock("@/features/tickets/components/TicketAssigneeSelect", () => ({
  TicketAssigneeSelect: () => null,
}));

// TicketTemplatePicker paso de ser el stub de WP-0A (siempre `null`) a un
// componente real con `useTicketTemplates` (WP-T, docs/PHASE_4_PLAN.md
// seccion 5) -- este archivo no envuelve `CreateTicketModal` en un
// `QueryClientProvider`, así que se mockea con el mismo patrón que
// `TicketAssigneeSelect` de arriba. El mock renderiza un botón que invoca
// `onApply` con la forma de la plantilla built-in, para poder probar el
// hallazgo de code-review de abajo sin depender del picker real (cubierto
// aparte por TicketTemplatePicker.test.tsx, dueño exclusivo de WP-T).
vi.mock("@/features/ticket-templates/components/TicketTemplatePicker", async () => {
  const React = await import("react");
  return {
    TicketTemplatePicker: ({
      onApply,
    }: {
      onApply: (t: { id: string; title_template: string; priority: string; description: string }) => void;
    }) =>
      React.createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onApply({ id: BUILT_IN_TEMPLATE_ID, title_template: "", priority: "none", description: "" }),
        },
        "aplicar built-in",
      ),
  };
});

function renderModal() {
  return render(
    <MemoryRouter>
      <CreateTicketModal isOpen onClose={() => {}} onCreate={vi.fn()} />
    </MemoryRouter>,
  );
}

describe("CreateTicketModal", () => {
  it("renders the default template content on open", async () => {
    renderModal();

    expect(await screen.findByText("📋 Descripción")).toBeInTheDocument();
    expect(screen.getByText("✅ Objetivos")).toBeInTheDocument();
    expect(screen.getByText("📎 Notas adicionales")).toBeInTheDocument();
    expect(screen.getByText("Definir alcance de la tarea")).toBeInTheDocument();
  });
});

// Hallazgo de code-review (Fase 4A, HIGH): aplicar la plantilla "por
// defecto" (BUILT_IN_TEMPLATE_ID) no debe mandar ese sentinel como
// `template_id` -- el backend lo valida como UUID y rechaza cualquier
// otra cosa con 400, rompiendo la creacion del ticket (D24: aplicar la
// built-in tiene que ser identico al comportamiento de antes de la fase).
describe("CreateTicketModal — applying the built-in template", () => {
  it("does not send BUILT_IN_TEMPLATE_ID as template_id when creating the ticket", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <CreateTicketModal isOpen onClose={() => {}} onCreate={onCreate} />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "aplicar built-in" }));
    await user.type(screen.getByPlaceholderText(/título/i), "Ticket de prueba");
    await user.click(screen.getByRole("button", { name: /crear ticket/i }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0];
    expect(payload.template_id).toBeUndefined();
  });
});
