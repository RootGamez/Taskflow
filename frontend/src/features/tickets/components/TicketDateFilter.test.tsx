import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TicketDateFilter } from "@/features/tickets/components/TicketDateFilter";
import { useTicketFilterStore } from "@/features/tickets/store/useTicketFilterStore";

const INITIAL_STATE = { preset: "all" as const, from: null, to: null };

// jsdom no implementa ResizeObserver, y @radix-ui/react-popper (usado por
// PopoverContent) lo necesita para medir el contenido al posicionarlo.
// Polyfill acotado a este archivo de test (no toca src/test/setup.ts,
// compartido con el resto de la suite).
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

afterEach(() => {
  useTicketFilterStore.setState({ dateFilter: INITIAL_STATE });
});

describe("TicketDateFilter", () => {
  test("opens the popover when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<TicketDateFilter />);

    expect(screen.queryByText("Filtrar por fecha")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));

    expect(await screen.findByText("Filtrar por fecha")).toBeInTheDocument();
  });

  test("selecting a chip calls setPreset (reflected in the store)", async () => {
    const user = userEvent.setup();
    render(<TicketDateFilter />);

    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));
    await user.click(await screen.findByRole("button", { name: "Hoy" }));

    expect(useTicketFilterStore.getState().dateFilter.preset).toBe("today");
  });

  test("shows the active filter label on the trigger", () => {
    useTicketFilterStore.setState({ dateFilter: { preset: "overdue", from: null, to: null } });

    render(<TicketDateFilter />);

    expect(screen.getByRole("button", { name: /filtrar tickets por fecha/i })).toHaveTextContent("Vencidos");
  });

  test("'Limpiar' is only visible when a filter is active", async () => {
    const user = userEvent.setup();
    render(<TicketDateFilter />);

    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));
    expect(screen.queryByRole("button", { name: /limpiar/i })).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Hoy" }));

    expect(await screen.findByRole("button", { name: /limpiar/i })).toBeInTheDocument();
  });

  test("clicking 'Limpiar' resets the filter to 'all'", async () => {
    const user = userEvent.setup();
    useTicketFilterStore.setState({ dateFilter: { preset: "overdue", from: null, to: null } });
    render(<TicketDateFilter />);

    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));
    await user.click(await screen.findByRole("button", { name: /limpiar/i }));

    expect(useTicketFilterStore.getState().dateFilter).toEqual(INITIAL_STATE);
  });

  test("the range calendar appears when choosing the custom range option", async () => {
    const user = userEvent.setup();
    render(<TicketDateFilter />);

    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /personalizado/i }));

    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  test("shows 'Personalizado' on the trigger when preset is custom without a full range yet", () => {
    useTicketFilterStore.setState({ dateFilter: { preset: "custom", from: null, to: null } });

    render(<TicketDateFilter />);

    expect(screen.getByRole("button", { name: /filtrar tickets por fecha/i })).toHaveTextContent(
      "Personalizado",
    );
  });

  test("shows the formatted range on the trigger when a full custom range is set", async () => {
    useTicketFilterStore.setState({
      dateFilter: { preset: "custom", from: "2026-08-05", to: "2026-08-10" },
    });
    const user = userEvent.setup();

    render(<TicketDateFilter />);

    expect(screen.getByRole("button", { name: /filtrar tickets por fecha/i })).toHaveTextContent(
      "05/08 - 10/08",
    );

    // También abrimos el popover con preset "custom" activo para cubrir la
    // rama que precarga el calendario con el rango ya seleccionado.
    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  test("picking a range in the calendar calls setCustomRange with both dates", async () => {
    const user = userEvent.setup();
    render(<TicketDateFilter />);

    await user.click(screen.getByRole("button", { name: /filtrar tickets por fecha/i }));
    await user.click(await screen.findByRole("button", { name: /personalizado/i }));
    await screen.findByRole("grid");

    // PopoverContent se renderiza en un Portal (fuera del container local de
    // render()), así que buscamos en document.body.
    const dayCells = Array.from(document.body.querySelectorAll<HTMLElement>("[data-day]"));
    const dayButtons = dayCells
      .map((cell) => cell.querySelector("button"))
      .filter((button): button is HTMLButtonElement => button !== null && !button.disabled);

    expect(dayButtons.length).toBeGreaterThan(5);

    await user.click(dayButtons[0]);
    await user.click(dayButtons[5]);

    const { dateFilter } = useTicketFilterStore.getState();
    expect(dateFilter.preset).toBe("custom");
    expect(dateFilter.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateFilter.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
