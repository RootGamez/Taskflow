import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { CreateWorkspaceModal } from "@/features/workspaces/components/CreateWorkspaceModal";
import { WorkspaceSelectDropdown } from "@/features/workspaces/components/WorkspaceSelectDropdown";
import {
  useCreateWorkspace,
  useSelectActiveWorkspace,
  useWorkspaces,
} from "@/features/workspaces/hooks/useWorkspaces";
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
    console.log("[WorkspaceSwitcher] Opening create modal");
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    console.log("[WorkspaceSwitcher] Closing create modal");
    setCreateModalOpen(false);
  };

  return (
    <>
      <WorkspaceSelectDropdown
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        isSelecting={selectActiveWorkspaceMutation.isPending}
        isLoading={isLoading}
        onSelectWorkspace={handleSelectWorkspace}
        onOpenCreate={handleOpenCreateModal}
      />

      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        onCreate={handleCreateWorkspace}
        isLoading={createWorkspaceMutation.isPending}
      />
    </>
  );
}
