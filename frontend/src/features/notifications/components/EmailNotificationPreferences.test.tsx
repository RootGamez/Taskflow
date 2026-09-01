import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailNotificationPreferences } from "@/features/notifications/components/EmailNotificationPreferences";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/features/notifications/hooks/useNotificationPreferences";
import type { NotificationPreferences } from "@/features/notifications/types/notificationPreferences.types";

vi.mock("@/features/notifications/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: vi.fn(),
  useUpdateNotificationPreferences: vi.fn(),
}));

const mockedUsePreferences = vi.mocked(useNotificationPreferences);
const mockedUseUpdate = vi.mocked(useUpdateNotificationPreferences);

const mutate = vi.fn();

function buildPreferences(
  overrides: Partial<NotificationPreferences> = {},
): NotificationPreferences {
  return {
    email_notifications: true,
    email_ticket_assigned: true,
    email_ticket_mentioned: true,
    email_ticket_commented: true,
    ...overrides,
  };
}

function mockQuery(
  overrides: Partial<ReturnType<typeof useNotificationPreferences>> = {},
) {
  mockedUsePreferences.mockReturnValue({
    data: buildPreferences(),
    isPending: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useNotificationPreferences>);
}

function switchFor(name: string): HTMLElement {
  return screen.getByRole("switch", { name });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseUpdate.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateNotificationPreferences>);
  mockQuery();
});

describe("EmailNotificationPreferences", () => {
  it("lista los tres tipos de correo que se pueden elegir", () => {
    render(<EmailNotificationPreferences />);

    expect(switchFor("Te asignan un ticket")).toBeInTheDocument();
    expect(switchFor("Te mencionan")).toBeInTheDocument();
    expect(switchFor("Comentan un ticket tuyo")).toBeInTheDocument();
  });

  it("todo llega activado por defecto", () => {
    render(<EmailNotificationPreferences />);

    expect(switchFor("Recibir correos de TaskFlow")).toBeChecked();
    expect(switchFor("Te asignan un ticket")).toBeChecked();
    expect(switchFor("Te mencionan")).toBeChecked();
    expect(switchFor("Comentan un ticket tuyo")).toBeChecked();
  });

  it("apagar un tipo guarda solo esa clave", () => {
    render(<EmailNotificationPreferences />);

    fireEvent.click(switchFor("Comentan un ticket tuyo"));

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ email_ticket_commented: false });
  });

  it("el interruptor maestro deshabilita los switches por tipo", () => {
    mockQuery({ data: buildPreferences({ email_notifications: false }) });

    render(<EmailNotificationPreferences />);

    expect(switchFor("Te mencionan")).toBeDisabled();
    expect(switchFor("Recibir correos de TaskFlow")).not.toBeDisabled();
  });

  it("mientras carga muestra los controles bloqueados", () => {
    mockQuery({ data: undefined, isPending: true });

    render(<EmailNotificationPreferences />);

    expect(switchFor("Te asignan un ticket")).toBeDisabled();
  });

  it("avisa cuando no se pudieron cargar las preferencias", () => {
    mockQuery({ data: undefined, isPending: false, isError: true });

    render(<EmailNotificationPreferences />);

    expect(screen.getByText(/No se pudieron cargar tus preferencias/)).toBeInTheDocument();
    expect(switchFor("Te mencionan")).toBeDisabled();
  });

  it("muestra el correo al que llegan los avisos", () => {
    render(<EmailNotificationPreferences email="ana@example.com" />);

    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("indica que esta guardando mientras el PATCH esta en vuelo", () => {
    mockedUseUpdate.mockReturnValue({
      mutate,
      isPending: true,
    } as unknown as ReturnType<typeof useUpdateNotificationPreferences>);

    render(<EmailNotificationPreferences />);

    expect(screen.getByText("Guardando")).toBeInTheDocument();
  });
});
