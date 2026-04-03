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
      toast.error(getApiErrorMessage(error, "No se pudieron cargar los workspaces"));
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
      toast.error(getApiErrorMessage(error, "No se pudo cambiar el workspace"));
    }
  };

  const handleCreateWorkspace = async (name: string) => {
    try {
      const workspace = await createWorkspaceMutation.mutateAsync(name);
      setActiveWorkspace(workspace);
      navigate(`/workspaces/${workspace.slug}`);
      toast.success("Workspace creado");
      setCreateModalOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el workspace"));
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
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Workspace actual</p>
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {activeWorkspace?.name ?? (isLoading ? "Cargando workspaces..." : "Sin workspace seleccionado")}
              </p>
              <p className="truncate text-xs capitalize text-zinc-500 dark:text-zinc-400">
                {activeWorkspace?.role ?? "Crea o selecciona uno"}
              </p>
            </div>
            {activeWorkspace ? (
              <Button
                size="sm"
                variant="flat"
                className="shrink-0"
                onPress={() => navigate(getWorkspaceDashboardPath(activeWorkspace.slug))}
              >
                Abrir
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">Cambiar workspace</p>
            <span className="text-xs text-zinc-400">{workspaces.length}</span>
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
                      "h-auto w-full justify-between rounded-xl border px-3 py-2 text-left",
                      isActive
                        ? "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900/70 dark:bg-brand-900/20 dark:text-brand-100"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/70",
                    )}
                    isDisabled={selectActiveWorkspaceMutation.isPending || isLoading}
                    onPress={() => {
                      void handleSelectWorkspace(workspace.id);
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          isActive
                            ? "border-brand-200 bg-brand-100 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200"
                            : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                        )}
                      >
                        <FolderKanban className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block truncate text-sm font-medium">{workspace.name}</span>
                        <span className="block text-xs capitalize text-zinc-500 dark:text-zinc-400">{workspace.role}</span>
                      </span>
                    </span>
                    {isActive ? <Check className="h-4 w-4 shrink-0 text-brand-600" /> : null}
                  </Button>
                );
              })
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Aún no tienes workspaces.
              </p>
            )}
          </div>

          {hasMoreWorkspaces ? (
            <p className="px-1 text-[11px] text-zinc-400">
              Mostrando {visibleWorkspaces.length} de {workspaces.length} workspaces.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant="flat"
            className="w-full justify-start text-brand-700 dark:text-brand-300"
            startContent={<Plus className="h-4 w-4" />}
            onPress={handleOpenCreateModal}
          >
            Crear workspace
          </Button>
          <Button
            type="button"
            variant="light"
            className="w-full justify-start"
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
