import { useState } from "react";
import { Button } from "@heroui/react";
import { CheckCircle2, Circle, Rocket, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateSprintModal, type CreateSprintInput } from "@/features/sprints/components/CreateSprintModal";
import { SprintDeleteDialog } from "@/features/sprints/components/SprintDeleteDialog";
import {
  useActivateSprint,
  useCompleteSprint,
  useCreateSprint,
  useDeleteSprint,
  useSprints,
} from "@/features/sprints/hooks/useSprints";
import type { Sprint } from "@/features/sprints/types/sprint.types";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

const STATUS_LABEL: Record<Sprint["status"], string> = {
  planned: "Planeado",
  active: "Actual",
  completed: "Completado",
};

export default function SprintsAdminPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);

  const { data: sprints = [] } = useSprints(workspaceSlug);
  const createSprint = useCreateSprint(workspaceSlug);
  const activateSprint = useActivateSprint(workspaceSlug);
  const completeSprint = useCompleteSprint(workspaceSlug);
  const deleteSprint = useDeleteSprint(workspaceSlug);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null);

  const handleCreate = async (input: CreateSprintInput) => {
    try {
      await createSprint.mutateAsync(input);
      setIsCreateOpen(false);
      toast.success("Sprint creado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el sprint"));
    }
  };

  const runAction = async (fn: () => Promise<unknown>, ok: string, fail: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (error) {
      toast.error(getApiErrorMessage(error, fail));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sprints del espacio"
        subtitle="El sprint marcado como actual es el que se abre al entrar al espacio"
        actions={
          <div className="flex gap-2">
            <Button variant="light" onPress={() => navigate(`/workspaces/${workspaceSlug}`)}>
              Ver tablero
            </Button>
            {canMutate ? (
              <Button color="primary" onPress={() => setIsCreateOpen(true)}>
                Nuevo sprint
              </Button>
            ) : null}
          </div>
        }
      />

      {sprints.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Sin sprints"
          description="Crea el primer sprint para empezar a planificar."
          action={canMutate ? { label: "Nuevo sprint", onClick: () => setIsCreateOpen(true) } : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {sprints.map((sprint) => (
            <li
              key={sprint.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Rocket
                    className={`h-4 w-4 ${sprint.status === "active" ? "text-primary" : "text-zinc-400"}`}
                  />
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{sprint.name}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                    {STATUS_LABEL[sprint.status]}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {sprint.start_date} → {sprint.end_date} · {sprint.completed_ticket_count}/
                  {sprint.ticket_count} completados
                </p>
              </div>

              {canMutate ? (
                <div className="flex items-center gap-1.5">
                  {sprint.status !== "active" ? (
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Circle className="h-3.5 w-3.5" />}
                      onPress={() =>
                        runAction(
                          () => activateSprint.mutateAsync(sprint.id),
                          `${sprint.name} es el sprint actual`,
                          "No se pudo activar",
                        )
                      }
                    >
                      Marcar como actual
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<CheckCircle2 className="h-3.5 w-3.5" />}
                      onPress={() =>
                        runAction(
                          () => completeSprint.mutateAsync(sprint.id),
                          "Sprint finalizado",
                          "No se pudo finalizar",
                        )
                      }
                    >
                      Finalizar
                    </Button>
                  )}
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label={`Eliminar ${sprint.name}`}
                    onPress={() => setDeleteTarget(sprint)}
                  >
                    <Trash2 className="h-4 w-4 text-zinc-400" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <CreateSprintModal
        isOpen={isCreateOpen}
        isLoading={createSprint.isPending}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
      <SprintDeleteDialog
        sprint={deleteTarget}
        isLoading={deleteSprint.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await runAction(
            () => deleteSprint.mutateAsync(deleteTarget.id),
            "Sprint eliminado",
            "No se pudo eliminar el sprint",
          );
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
