import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CreateTicketModal } from "@/features/tickets/components/CreateTicketModal";

// Smoke test de WP-0A (docs/PHASE_4_PLAN.md seccion 3.6, test 10): no
// esta cubierto por el umbral de `vitest.config.ts` (CreateTicketModal.tsx
// nunca estuvo en `COVERED_PATHS`), pero es la garantia de que mover
// `DEFAULT_DESCRIPTION` a `defaultTicketTemplate.ts` (R0A-2) no rompio el
// contenido con el que el modal precarga el editor al abrirse.

vi.mock("@/features/tickets/components/TicketAssigneeSelect", () => ({
  TicketAssigneeSelect: () => null,
}));

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
