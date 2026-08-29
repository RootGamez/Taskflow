import { Button } from "@heroui/react";
import { Check, FolderKanban, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { CreateWorkspaceModal } from "@/features/workspaces/components/CreateWorkspaceModal";
import { useCreateWorkspace, useSelectActiveWorkspace, useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { getWorkspaceDashboardPath } from "@/features/workspaces/lib/workspaceRouting";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export function WorkspaceSwitcher() {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const navigate = useNavigate();
  const { data: workspaces = [], isError, error, isLoading } = useWorkspaces();
  const createWorkspaceMutation = useCreateWorkspace();
  const selectActiveWorkspaceMutation = useSelectActiveWorkspace();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);

  useEffect(() => {
    if (workspaces.length === 0) {
      return;
    }

    const serverActiveWorkspace =
      workspaces.find((workspace) => workspace.is_active) ?? workspaces[0];

    if (!activeWorkspace || activeWorkspace.id !== serverActiveWorkspace.id) {
      setActiveWorkspace(serverActiveWorkspace);
    }
  }, [workspaces, activeWorkspace, setActiveWorkspace]);

  useEffect(() => {
    if (isError) {
      toast.error(getApiErrorMessage(error, "No se pudieron cargar los espacios de trabajo"));
    }
  }, [isError, error]);

  const handleSelectWorkspace = async (workspaceId: string) => {
    const selected = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!selected) {
      return;
    }

    try {
      const active = await selectActiveWorkspaceMutation.mutateAsync(selected.id);
      setActiveWorkspace(active);
      navigate(`/workspaces/${active.slug}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo cambiar el espacio de trabajo"));
    }
  };

  const handleCreateWorkspace = async (name: string) => {
    try {
      const workspace = await createWorkspaceMutation.mutateAsync(name);
      setActiveWorkspace(workspace);
      navigate(`/workspaces/${workspace.slug}`);
      toast.success("Espacio de trabajo creado");
      setCreateModalOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el espacio de trabajo"));
    }
  };

  const handleOpenCreateModal = () => {
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
  };

  const hasWorkspaces = workspaces.length > 0;
  const recentWorkspaces = activeWorkspace
    ? [activeWorkspace, ...workspaces.filter((workspace) => workspace.id !== activeWorkspace.id)]
    : workspaces;
  const visibleWorkspaces = recentWorkspaces.slice(0, 4);
  const hasMoreWorkspaces = workspaces.length > visibleWorkspaces.length;

  return (
    <>
      <div className="space-y-3">
        <div className="border-2 border-border bg-secondary p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">Espacio actual</p>
              <p className="truncate text-sm font-semibold text-foreground">
                {activeWorkspace?.name ?? (isLoading ? "Cargando espacios..." : "Sin espacio seleccionado")}
              </p>
              <p className="truncate font-mono text-xs uppercase text-muted-foreground">
                {activeWorkspace?.role ?? "Crea o selecciona uno"}
              </p>
            </div>
            {activeWorkspace ? (
              <Button
                size="sm"
                variant="flat"
                className="shrink-0 rounded-none"
                onPress={() => navigate(getWorkspaceDashboardPath(activeWorkspace.slug))}
              >
                Abrir
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Cambiar espacio</p>
            <span className="font-mono text-xs text-muted-foreground">{workspaces.length}</span>
          </div>

          <div className="space-y-1.5">
            {hasWorkspaces ? (
              visibleWorkspaces.map((workspace) => {
                const isActive = activeWorkspace?.id === workspace.id;

                return (
                  <Button
                    key={workspace.id}
                    type="button"
                    variant="light"
                    className={cn(
                      "h-auto w-full justify-between rounded-none border-2 px-3 py-2 text-left",
                      isActive
                        ? "border-primary bg-secondary text-foreground"
                        : "border-border bg-card text-foreground hover:bg-accent",
                    )}
                    isDisabled={selectActiveWorkspaceMutation.isPending || isLoading}
                    onPress={() => {
                      void handleSelectWorkspace(workspace.id);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "boxed-icon h-8 w-8 shrink-0",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        <FolderKanban className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-sm font-medium">{workspace.name}</span>
                        <span className="block font-mono text-xs uppercase text-muted-foreground">
                          {workspace.role}
                        </span>
                      </span>
                    </span>
                    {isActive ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </Button>
                );
              })
            ) : (
              <p className="border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Aún no tienes espacios de trabajo.
              </p>
            )}
          </div>

          {hasMoreWorkspaces ? (
            <p className="px-1 font-mono text-[11px] text-muted-foreground">
              Mostrando {visibleWorkspaces.length} de {workspaces.length} espacios.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="flat"
            className="w-full justify-start rounded-none text-primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={handleOpenCreateModal}
          >
            Crear espacio
          </Button>
          <Button
            type="button"
            variant="light"
            className="w-full justify-start rounded-none"
            onPress={() => navigate("/workspaces")}
          >
            Ver todos
          </Button>
        </div>
      </div>

      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onCreate={handleCreateWorkspace}
        isLoading={createWorkspaceMutation.isPending}
      />
    </>
  );
}
