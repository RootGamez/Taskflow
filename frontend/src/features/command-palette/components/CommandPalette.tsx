import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Command, CommandInput, CommandList } from "@/components/ui/shadcn/command";
import { Dialog, DialogContent } from "@/components/ui/shadcn/dialog";
import { CommandPaletteActions } from "@/features/command-palette/components/CommandPaletteActions";
import { CommandPaletteProjects } from "@/features/command-palette/components/CommandPaletteProjects";
import { CommandPaletteTickets } from "@/features/command-palette/components/CommandPaletteTickets";
import { buildNavigationActions, resolveWorkspaceSlug } from "@/features/command-palette/lib/buildNavigationActions";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useGlobalSearch } from "@/features/search/hooks/useGlobalSearch";
import type { SearchResult } from "@/features/search/types/search.types";
import { useSprints } from "@/features/sprints/hooks/useSprints";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { useCommandActionsStore } from "@/store/commandActionsStore";
import { useCommandPaletteStore } from "@/store/commandPaletteStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

/**
 * Overlay global del command palette (`Cmd/Ctrl+K`) -- WP-A, Fase 3.
 * Reemplaza el stub de WP-0 (D4).
 *
 * NO usa `CommandDialog` de `components/ui/shadcn/command.tsx`: ese
 * wrapper hardcodea su propio `<Command>` sin exponer `shouldFilter`, y
 * D21 exige `shouldFilter={false}` -- si no, cmdk re-filtraria el grupo
 * "Tickets" sobre el texto ya renderizado y descartaria resultados que
 * matchean por `description_text` pero no por titulo (RA2). Se compone
 * `Dialog`/`DialogContent` (de `dialog.tsx`, sin restricciones) con
 * `Command` (de `command.tsx`, que si reenvia `shouldFilter` via
 * `...props`) directamente, sin tocar ninguno de los dos archivos.
 */
export function CommandPalette() {
  const isOpen = useCommandPaletteStore((state) => state.isOpen);
  const close = useCommandPaletteStore((state) => state.close);
  const actionHandlers = useCommandActionsStore((state) => state.actions);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setTheme = useUIStore((state) => state.setTheme);
  const setSprintScope = useSprintScopeStore((state) => state.setScope);
  const navigate = useNavigate();
  const params = useParams();
  const [query, setQuery] = useState("");

  const { data: workspaces = [] } = useWorkspaces();
  const workspaceSlug = resolveWorkspaceSlug({
    routeWorkspaceSlug: params.workspaceSlug,
    activeWorkspace,
    workspaces,
  });

  const { data: projects = [] } = useProjects(workspaceSlug);
  const { data: sprints = [] } = useSprints(workspaceSlug);
  const activeSprint = sprints.find((sprint) => sprint.status === "active") ?? null;

  const { results, isLoading } = useGlobalSearch(query, workspaceSlug || undefined);

  const closePalette = () => {
    close();
    setQuery("");
  };

  const navigationActions = useMemo(
    () =>
      buildNavigationActions({
        routeParams: { workspaceSlug: params.workspaceSlug, projectId: params.projectId },
        activeWorkspace,
        workspaces,
        activeSprintId: activeSprint?.id ?? null,
        hasCreateTicketHandler: Boolean(actionHandlers["create-ticket"]),
        onCreateTicket: () => actionHandlers["create-ticket"]?.(),
        onGoToActiveSprint: (slug, projectId, sprintId) => {
          setSprintScope({ kind: "sprint", sprintId });
          navigate(`/workspaces/${slug}/projects/${projectId}/board`);
        },
        onNavigate: (path) => navigate(path),
        onSetTheme: setTheme,
      }),
    [
      params.workspaceSlug,
      params.projectId,
      activeWorkspace,
      workspaces,
      activeSprint,
      actionHandlers,
      setSprintScope,
      navigate,
      setTheme,
    ],
  );

  const handleTicketSelect = (result: SearchResult) => {
    closePalette();
    navigate(`/tickets/${result.id}`);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closePalette();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command
          shouldFilter={false}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500 dark:[&_[cmdk-group-heading]]:text-zinc-400"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar tickets, proyectos, acciones..."
          />
          <CommandList>
            <CommandPaletteActions actions={navigationActions} query={query} closePalette={closePalette} />
            <CommandPaletteProjects
              projects={projects}
              workspaceSlug={workspaceSlug}
              query={query}
              onNavigate={(path) => navigate(path)}
              closePalette={closePalette}
            />
            <CommandPaletteTickets results={results} isLoading={isLoading} onSelect={handleTicketSelect} />
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
