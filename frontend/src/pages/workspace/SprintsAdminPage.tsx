import { useState } from "react";
import { Button } from "@heroui/react";
import { CheckCircle2, Circle, Rocket, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/shadcn/badge";
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

const STATUS_BADGE: Record<Sprint["status"], "primary" | "success" | "outline"> = {
  planned: "outline",
  active: "primary",
  completed: "success",
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
        eyebrow="Espacio"
        title="Sprints del espacio"
        subtitle="El sprint marcado como actual es el que se abre al entrar al espacio"
        actions={
          <div className="flex gap-2">
            <Button variant="light" className="rounded-none" onPress={() => navigate(`/workspaces/${workspaceSlug}`)}>
              Ver tablero
            </Button>
            {canMutate ? (
              <Button color="primary" className="rounded-none" onPress={() => setIsCreateOpen(true)}>
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
        <ul className="divide-y-2 divide-border border-2 border-border">
          {sprints.map((sprint) => (
            <li
              key={sprint.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-card p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Rocket
                    className={`h-4 w-4 ${sprint.status === "active" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="font-medium text-foreground">{sprint.name}</span>
                  <Badge variant={STATUS_BADGE[sprint.status]} mono>
                    {STATUS_LABEL[sprint.status]}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
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
                      className="rounded-none"
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
                      className="rounded-none"
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
                    className="rounded-none"
                    aria-label={`Eliminar ${sprint.name}`}
                    onPress={() => setDeleteTarget(sprint)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
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
