import type { ThemeMode } from "@/types/global.types";

export interface CommandActionItem {
  id: string;
  label: string;
  onSelect: () => void;
}

interface WorkspaceLike {
  slug: string;
  is_active: boolean;
}

export interface ResolveWorkspaceSlugInput {
  routeWorkspaceSlug?: string;
  activeWorkspace?: { slug: string } | null;
  workspaces?: readonly WorkspaceLike[];
}

/**
 * D24 de docs/PHASE_3_PLAN.md: replica LITERALMENTE el fallback de
 * `Sidebar.tsx:16` (`params.workspaceSlug ?? activeWorkspace?.slug ??
 * workspaces.find(w => w.is_active)?.slug ?? workspaces[0]?.slug ?? ""`).
 * Duplicacion deliberada de 1 funcion (no se extrae a
 * `features/workspaces/lib/`, que es de otra feature) en vez de acoplar
 * este agente con el dueño del Sidebar.
 */
export function resolveWorkspaceSlug(input: ResolveWorkspaceSlugInput): string {
  return (
    input.routeWorkspaceSlug ??
    input.activeWorkspace?.slug ??
    input.workspaces?.find((workspace) => workspace.is_active)?.slug ??
    input.workspaces?.[0]?.slug ??
    ""
  );
}

export interface BuildNavigationActionsInput {
  routeParams: { workspaceSlug?: string; projectId?: string };
  activeWorkspace?: { slug: string } | null;
  workspaces?: readonly WorkspaceLike[];
  /** `null` cuando no hay sprint `status === "active"` en el proyecto actual. */
  activeSprintId: string | null;
  hasCreateTicketHandler: boolean;
  onCreateTicket: () => void;
  onGoToActiveSprint: (workspaceSlug: string, projectId: string, sprintId: string) => void;
  onNavigate: (path: string) => void;
  onSetTheme: (theme: ThemeMode) => void;
}

/**
 * Acciones v1 del palette (D25, cerradas): Crear ticket (solo con handler
 * registrado, D8), Ir al sprint activo (solo en ruta de proyecto con un
 * sprint activo), Mis tareas / Dashboard / Espacios (siempre), Tema
 * Claro/Oscuro/Sistema (siempre). Funcion pura: el componente que la llama
 * (`CommandPaletteActions.tsx`) resuelve los datos via hooks y pasa
 * callbacks ya cerrados sobre `navigate`/`setTheme`/el store de sprint.
 */
export function buildNavigationActions(input: BuildNavigationActionsInput): CommandActionItem[] {
  const workspaceSlug = resolveWorkspaceSlug({
    routeWorkspaceSlug: input.routeParams.workspaceSlug,
    activeWorkspace: input.activeWorkspace,
    workspaces: input.workspaces,
  });

  const actions: CommandActionItem[] = [];

  if (input.hasCreateTicketHandler) {
    actions.push({ id: "create-ticket", label: "Crear ticket", onSelect: input.onCreateTicket });
  }

  const { projectId } = input.routeParams;
  if (projectId && input.activeSprintId) {
    const sprintId = input.activeSprintId;
    actions.push({
      id: "go-active-sprint",
      label: "Ir al sprint activo",
      onSelect: () => input.onGoToActiveSprint(workspaceSlug, projectId, sprintId),
    });
  }

  actions.push(
    { id: "go-my-tasks", label: "Ir a Mis tareas", onSelect: () => input.onNavigate("/my-tasks") },
    { id: "go-dashboard", label: "Ir al Dashboard", onSelect: () => input.onNavigate("/dashboard") },
    { id: "go-workspaces", label: "Ir a Espacios", onSelect: () => input.onNavigate("/workspaces") },
    { id: "theme-light", label: "Tema: Claro", onSelect: () => input.onSetTheme("light") },
    { id: "theme-dark", label: "Tema: Oscuro", onSelect: () => input.onSetTheme("dark") },
    { id: "theme-system", label: "Tema: Sistema", onSelect: () => input.onSetTheme("system") },
  );

  return actions;
}
