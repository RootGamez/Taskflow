import { useMemo, useState } from "react";
import { ChevronDown, Layers, Plus, Rocket, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { CreateSprintModal, type CreateSprintInput } from "@/features/sprints/components/CreateSprintModal";
import { SprintDeleteDialog } from "@/features/sprints/components/SprintDeleteDialog";
import {
  useActivateSprint,
  useCreateSprint,
  useDeleteSprint,
  useSprints,
} from "@/features/sprints/hooks/useSprints";
import { useSprintScopeStore } from "@/features/sprints/store/useSprintScopeStore";
import type { Sprint, SprintScope } from "@/features/sprints/types/sprint.types";
import { getApiErrorMessage } from "@/lib/errors";

interface SprintSelectorProps {
  workspaceSlug: string;
  canMutate: boolean;
}

/** Sprint activo primero (DESIGN_SYSTEM.md §8.1: "sprint activo destacado
 * arriba"), preservando el orden relativo del resto (mas reciente primero,
 * ya resuelto por el `ordering` del modelo backend). */
function sortSprintsForMenu(sprints: Sprint[]): Sprint[] {
  const active = sprints.filter((sprint) => sprint.status === "active");
  const rest = sprints.filter((sprint) => sprint.status !== "active");
  return [...active, ...rest];
}

function scopeLabel(scope: SprintScope, sprints: Sprint[]): string {
  if (scope.kind === "all") {
    return "Todos";
  }
  if (scope.kind === "backlog") {
    return "Backlog";
  }
  if (scope.kind === "current") {
    const active = sprints.find((sprint) => sprint.status === "active");
    return active ? active.name : "Sprint actual";
  }
  return sprints.find((sprint) => sprint.id === scope.sprintId)?.name ?? "Sprint";
}

export function SprintSelector({ workspaceSlug, canMutate }: SprintSelectorProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null);

  const { data: sprints = [] } = useSprints(workspaceSlug);
  const scope = useSprintScopeStore((state) => state.scope);
  const setScope = useSprintScopeStore((state) => state.setScope);
  const createSprintMutation = useCreateSprint(workspaceSlug);
  const activateSprintMutation = useActivateSprint(workspaceSlug);
  const deleteSprintMutation = useDeleteSprint(workspaceSlug);

  const orderedSprints = useMemo(() => sortSprintsForMenu(sprints), [sprints]);

  const handleSelect = (nextScope: SprintScope) => {
    setScope(nextScope);
    setIsMenuOpen(false);
  };

  const handleActivate = async (sprint: Sprint, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await activateSprintMutation.mutateAsync(sprint.id);
      toast.success(`${sprint.name} esta activo`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo activar el sprint"));
    }
  };

  const handleRequestDelete = (sprint: Sprint, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteTarget(sprint);
    setIsMenuOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteSprintMutation.mutateAsync(deleteTarget.id);
      if (scope.kind === "sprint" && scope.sprintId === deleteTarget.id) {
        setScope({ kind: "all" });
      }
      toast.success("Sprint eliminado");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el sprint"));
    }
  };

  const handleCreate = async (input: CreateSprintInput) => {
    try {
      const sprint = await createSprintMutation.mutateAsync(input);
      setIsCreateOpen(false);
      setScope({ kind: "sprint", sprintId: sprint.id });
      toast.success("Sprint creado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el sprint"));
    }
  };

  return (
    <>
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" aria-label="Filtrar tickets por sprint">
            <Rocket className="h-3.5 w-3.5" />
            <span>Sprint: {scopeLabel(scope, sprints)}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <button
            type="button"
            onClick={() => handleSelect({ kind: "all" })}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${scope.kind === "all" ? "font-semibold" : ""}`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => handleSelect({ kind: "backlog" })}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${scope.kind === "backlog" ? "font-semibold" : ""}`}
          >
            <Layers className="h-3.5 w-3.5" />
            Backlog
          </button>

          {orderedSprints.length > 0 ? <div className="my-1 h-px bg-border" /> : null}

          {orderedSprints.map((sprint) => {
            const isSelected = scope.kind === "sprint" && scope.sprintId === sprint.id;
            return (
              <div
                key={sprint.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect({ kind: "sprint", sprintId: sprint.id })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSelect({ kind: "sprint", sprintId: sprint.id });
                  }
                }}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${isSelected ? "font-semibold" : ""}`}
              >
                <Rocket
                  className={`h-3.5 w-3.5 shrink-0 ${sprint.status === "active" ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
                {canMutate && sprint.status !== "active" ? (
                  <button
                    type="button"
                    onClick={(event) => void handleActivate(sprint, event)}
                    className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                  >
                    Activar
                  </button>
                ) : null}
                {canMutate ? (
                  <button
                    type="button"
                    aria-label={`Eliminar ${sprint.name}`}
                    onClick={(event) => handleRequestDelete(sprint, event)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}

          {canMutate ? (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(true);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-medium text-primary hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo sprint
              </button>
            </>
          ) : null}
        </PopoverContent>
      </Popover>

      <CreateSprintModal
        isOpen={isCreateOpen}
        isLoading={createSprintMutation.isPending}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
      <SprintDeleteDialog
        sprint={deleteTarget}
        isLoading={deleteSprintMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
