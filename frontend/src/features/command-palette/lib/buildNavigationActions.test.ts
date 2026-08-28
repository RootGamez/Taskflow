import { describe, expect, it, vi } from "vitest";

import { buildNavigationActions, resolveWorkspaceSlug } from "@/features/command-palette/lib/buildNavigationActions";

function baseInput(overrides: Partial<Parameters<typeof buildNavigationActions>[0]> = {}) {
  return {
    routeParams: {},
    activeWorkspace: null,
    workspaces: [],
    activeSprintId: null,
    hasCreateTicketHandler: false,
    onCreateTicket: vi.fn(),
    onGoToActiveSprint: vi.fn(),
    onNavigate: vi.fn(),
    onSetTheme: vi.fn(),
    ...overrides,
  };
}

describe("buildNavigationActions", () => {
  it("always includes Mis tareas, Dashboard y Espacios", () => {
    const actions = buildNavigationActions(baseInput());

    const ids = actions.map((action) => action.id);
    expect(ids).toContain("go-my-tasks");
    expect(ids).toContain("go-dashboard");
    expect(ids).toContain("go-workspaces");
  });

  it('includes "Ir al sprint activo" only when there is an active sprint', () => {
    const withoutSprint = buildNavigationActions(
      baseInput({ routeParams: { workspaceSlug: "producto", projectId: "project-1" }, activeSprintId: null }),
    );
    expect(withoutSprint.some((action) => action.id === "go-active-sprint")).toBe(false);

    const onGoToActiveSprint = vi.fn();
    const withSprint = buildNavigationActions(
      baseInput({
        routeParams: { workspaceSlug: "producto", projectId: "project-1" },
        activeSprintId: "sprint-1",
        onGoToActiveSprint,
      }),
    );
    const sprintAction = withSprint.find((action) => action.id === "go-active-sprint");
    expect(sprintAction).toBeDefined();

    sprintAction!.onSelect();
    expect(onGoToActiveSprint).toHaveBeenCalledWith("producto", "project-1", "sprint-1");
  });

  it('includes "Crear ticket" only when the action is registered', () => {
    const withoutHandler = buildNavigationActions(baseInput({ hasCreateTicketHandler: false }));
    expect(withoutHandler.some((action) => action.id === "create-ticket")).toBe(false);

    const onCreateTicket = vi.fn();
    const withHandler = buildNavigationActions(baseInput({ hasCreateTicketHandler: true, onCreateTicket }));
    const createAction = withHandler.find((action) => action.id === "create-ticket");
    expect(createAction).toBeDefined();

    createAction!.onSelect();
    expect(onCreateTicket).toHaveBeenCalledTimes(1);
  });

  it("wires Dashboard, Espacios and the theme actions to their respective callbacks", () => {
    const onNavigate = vi.fn();
    const onSetTheme = vi.fn();
    const actions = buildNavigationActions(baseInput({ onNavigate, onSetTheme }));

    const byId = (id: string) => actions.find((action) => action.id === id)!;

    byId("go-dashboard").onSelect();
    expect(onNavigate).toHaveBeenCalledWith("/dashboard");

    byId("go-workspaces").onSelect();
    expect(onNavigate).toHaveBeenCalledWith("/workspaces");

    byId("theme-light").onSelect();
    expect(onSetTheme).toHaveBeenCalledWith("light");

    byId("theme-dark").onSelect();
    expect(onSetTheme).toHaveBeenCalledWith("dark");

    byId("theme-system").onSelect();
    expect(onSetTheme).toHaveBeenCalledWith("system");
  });

  it("resolves workspaceSlug from the active workspace fallback", () => {
    // Sin parametro de ruta, sin workspace activo -> cae al primero
    // marcado is_active de la lista de workspaces (mismo fallback que
    // Sidebar.tsx:16, D24).
    expect(
      resolveWorkspaceSlug({
        routeWorkspaceSlug: undefined,
        activeWorkspace: null,
        workspaces: [
          { slug: "otro", is_active: false },
          { slug: "producto", is_active: true },
        ],
      }),
    ).toBe("producto");

    // El parametro de ruta gana sobre todo lo demas.
    expect(
      resolveWorkspaceSlug({
        routeWorkspaceSlug: "de-la-ruta",
        activeWorkspace: { slug: "activo" },
        workspaces: [{ slug: "primero", is_active: true }],
      }),
    ).toBe("de-la-ruta");

    // El workspace activo (store) gana sobre la lista completa.
    expect(
      resolveWorkspaceSlug({
        routeWorkspaceSlug: undefined,
        activeWorkspace: { slug: "activo" },
        workspaces: [{ slug: "primero", is_active: true }],
      }),
    ).toBe("activo");

    // Sin nada disponible: cadena vacia.
    expect(resolveWorkspaceSlug({ routeWorkspaceSlug: undefined, activeWorkspace: null, workspaces: [] })).toBe("");
  });
});
