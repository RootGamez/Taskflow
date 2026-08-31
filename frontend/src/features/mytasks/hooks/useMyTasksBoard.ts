import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import { getWorkspaceStatuses } from "@/features/board/api/statusesApi";
import { useMyTasks } from "@/features/mytasks/hooks/useMyTasks";
import type { MyTask } from "@/features/mytasks/types/myTask.types";
import {
  mergeWorkspaceStatuses,
  type MergedStatusColumn,
} from "@/features/mytasks/utils/mergeWorkspaceStatuses";
import { getSprintsByWorkspace } from "@/features/sprints/api/sprintsApi";
import { sprintQueryKeys } from "@/features/sprints/lib/sprintQueryKeys";
import type { Sprint, WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";

/** Sprints de un espacio, para poder agruparlos en el filtro. */
export interface WorkspaceSprints {
  workspaceSlug: string;
  workspaceName: string;
  sprints: Sprint[];
}

export interface MyTasksBoardData {
  tasks: MyTask[];
  columns: MergedStatusColumn[];
  columnIdByStatusId: Map<string, string>;
  /** Sprint activo de cada espacio: la vista es cross-espacio y cada uno tiene el suyo. */
  activeSprintIdByWorkspaceSlug: Map<string, string>;
  sprintsByWorkspace: WorkspaceSprints[];
  /** Espacios donde el rol permite mover tickets. */
  canMutateWorkspaceSlug: (workspaceSlug: string) => boolean;
  isLoading: boolean;
}

/**
 * Datos del tablero de "Mis tareas". La vista es cross-espacio y no hay
 * endpoints cross-espacio de estados ni de sprints, así que se piden por
 * espacio (solo los que aparecen en las tareas) y se fusionan acá. Las queries
 * comparten `queryKey` con `useWorkspaceStatuses`/`useSprints`, así que
 * reutilizan la caché en vez de duplicar tráfico.
 *
 * La combinación de los resultados va en `combine` (no en un `useMemo` con las
 * queries en las dependencias): la cantidad de espacios cambia entre renders y
 * un array de dependencias de largo variable no es válido.
 */
export function useMyTasksBoard(): MyTasksBoardData {
  const { data: tasks = [], isLoading: isLoadingTasks } = useMyTasks();
  const { data: workspaces = [] } = useWorkspaces();

  // Solo los espacios con tareas propias: pedir estados de espacios donde el
  // usuario no tiene nada asignado sería tráfico puro.
  const workspaceSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const task of tasks) slugs.add(task.project.workspace_slug);
    return [...slugs].sort();
  }, [tasks]);

  const statuses = useQueries({
    queries: workspaceSlugs.map((slug) => ({
      queryKey: ["workspace-statuses", slug] as const,
      queryFn: () => getWorkspaceStatuses(slug),
    })),
    combine: (results) => ({
      byWorkspaceSlug: new Map<string, WorkspaceStatus[]>(
        workspaceSlugs.map((slug, index) => [slug, results[index]?.data ?? []]),
      ),
      isLoading: results.some((result) => result.isLoading),
    }),
  });

  const sprints = useQueries({
    queries: workspaceSlugs.map((slug) => ({
      queryKey: sprintQueryKeys.list(slug),
      queryFn: () => getSprintsByWorkspace(slug),
    })),
    combine: (results) => ({
      byWorkspaceSlug: new Map<string, Sprint[]>(
        workspaceSlugs.map((slug, index) => [slug, results[index]?.data ?? []]),
      ),
      isLoading: results.some((result) => result.isLoading),
    }),
  });

  const { columns, columnIdByStatusId } = useMemo(
    () => mergeWorkspaceStatuses(statuses.byWorkspaceSlug),
    [statuses.byWorkspaceSlug],
  );

  const sprintsByWorkspace = useMemo(
    () =>
      workspaceSlugs.map((slug) => ({
        workspaceSlug: slug,
        workspaceName: workspaces.find((workspace) => workspace.slug === slug)?.name ?? slug,
        sprints: sprints.byWorkspaceSlug.get(slug) ?? [],
      })),
    [sprints.byWorkspaceSlug, workspaceSlugs, workspaces],
  );

  const activeSprintIdByWorkspaceSlug = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const entry of sprintsByWorkspace) {
      const active = entry.sprints.find((sprint) => sprint.status === "active");
      if (active) mapping.set(entry.workspaceSlug, active.id);
    }
    return mapping;
  }, [sprintsByWorkspace]);

  const canMutateWorkspaceSlug = useMemo(() => {
    const roleBySlug = new Map(workspaces.map((workspace) => [workspace.slug, workspace.role]));
    return (workspaceSlug: string) => canMutateWorkspace(roleBySlug.get(workspaceSlug));
  }, [workspaces]);

  return {
    tasks,
    columns,
    columnIdByStatusId,
    activeSprintIdByWorkspaceSlug,
    sprintsByWorkspace,
    canMutateWorkspaceSlug,
    isLoading: isLoadingTasks || statuses.isLoading || sprints.isLoading,
  };
}
