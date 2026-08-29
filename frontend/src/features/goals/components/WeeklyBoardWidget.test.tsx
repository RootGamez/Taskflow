import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as goalsApi from "@/features/goals/api/goalsApi";
import { WeeklyBoardWidget } from "@/features/goals/components/WeeklyBoardWidget";
import type { WeeklyBoard } from "@/features/goals/types/goals.types";

vi.mock("@/hooks/useBreakpoint", () => ({ useIsMobile: () => false }));

function buildBoard(overrides: Partial<WeeklyBoard> = {}): WeeklyBoard {
  return {
    id: "b1",
    week_start: "2026-08-25",
    created_at: "2026-08-25T00:00:00Z",
    can_manage: true,
    items: [
      {
        id: "i1",
        text: "Deploy v2.4 a producción",
        is_done: true,
        order: 1,
        completed_by: { id: "u1", full_name: "Ana Pérez", email: "ana@acme.io" },
        completed_at: "2026-08-26T10:00:00Z",
        created_at: "2026-08-25T00:00:00Z",
      },
      {
        id: "i2",
        text: "Onboarding 2 clientes nuevos",
        is_done: false,
        order: 2,
        completed_by: null,
        completed_at: null,
        created_at: "2026-08-25T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

function renderWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return render(<WeeklyBoardWidget workspaceSlug="acme" />, { wrapper: Wrapper });
}

describe("WeeklyBoardWidget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the week range, the done/total seal and per-goal completion author", async () => {
    vi.spyOn(goalsApi, "getWeeklyBoard").mockResolvedValue(buildBoard());

    renderWidget();

    expect(await screen.findByText(/Semana del 25 – 31 AGO/i)).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("— Ana Pérez")).toBeInTheDocument();
  });

  it("toggles is_done via the square checkbox (optimistic)", async () => {
    vi.spyOn(goalsApi, "getWeeklyBoard").mockResolvedValue(buildBoard());
    const update = vi
      .spyOn(goalsApi, "updateGoalItem")
      .mockResolvedValue(buildBoard().items[1]);

    renderWidget();

    const checkbox = await screen.findByRole("checkbox", {
      name: /Marcar como cumplida: Onboarding 2 clientes nuevos/i,
    });
    await userEvent.click(checkbox);

    expect(update).toHaveBeenCalledWith("acme", "i2", { is_done: true });
  });

  it("hides management controls for members who cannot manage", async () => {
    vi.spyOn(goalsApi, "getWeeklyBoard").mockResolvedValue(buildBoard({ can_manage: false }));

    renderWidget();

    await screen.findByText(/Semana del/i);
    expect(screen.queryByRole("button", { name: /Agregar meta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar meta/i })).not.toBeInTheDocument();
  });

  it("does not render at all for a non-manager when there are no goals", async () => {
    vi.spyOn(goalsApi, "getWeeklyBoard").mockResolvedValue(
      buildBoard({ can_manage: false, items: [] }),
    );

    const { container } = renderWidget();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("lets a manager add a goal inline (no modal): type + Enter", async () => {
    vi.spyOn(goalsApi, "getWeeklyBoard").mockResolvedValue(buildBoard({ items: [] }));
    const create = vi.spyOn(goalsApi, "createGoalItem").mockResolvedValue({
      id: "i9",
      text: "Revisar métricas",
      is_done: false,
      order: 1,
      completed_by: null,
      completed_at: null,
      created_at: "2026-08-25T00:00:00Z",
    });

    renderWidget();

    await userEvent.click(await screen.findByRole("button", { name: /Agregar meta/i }));
    const input = screen.getByLabelText("Texto de la nueva meta");
    await userEvent.type(input, "Revisar métricas{enter}");

    expect(create).toHaveBeenCalledWith("acme", { text: "Revisar métricas" });
  });
});
