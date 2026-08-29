import { Button } from "@heroui/react";
import { useQueries } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getWorkspaceMembers } from "@/features/members/api/membersApi";
import type { WorkspaceMember } from "@/features/members/types/member.types";
import { WorkspaceCard } from "@/features/workspaces/components/WorkspaceCard";
import { CreateWorkspaceModal } from "@/features/workspaces/components/CreateWorkspaceModal";
import { useCreateWorkspace, useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const createWorkspaceMutation = useCreateWorkspace();
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  const workspaceMemberQueries = useQueries({
    queries: workspaces.map((workspace) => ({
      queryKey: ["workspace-members-preview", workspace.id],
      queryFn: () => getWorkspaceMembers(workspace.slug),
      enabled: Boolean(workspace.slug),
      staleTime: 0,
    })),
  }) as Array<{ data?: WorkspaceMember[] }>;

  const workspacePreviews = useMemo(
    () =>
      (workspaces as Workspace[]).map((workspace, index) => ({
        workspace,
        members: workspaceMemberQueries[index]?.data ?? [],
      })),
    [workspaceMemberQueries, workspaces],
  );

  const handleCreateWorkspace = async (name: string) => {
    try {
      const workspace = await createWorkspaceMutation.mutateAsync(name);
      setActiveWorkspace(workspace);
      setIsCreateWorkspaceOpen(false);
      navigate(`/workspaces/${workspace.slug}`);
      toast.success("Espacio de trabajo creado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el espacio de trabajo"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Espacios"
        title="Todos los espacios de trabajo"
        subtitle="Explora tus espacios de trabajo y abre cualquiera en un clic."
        actions={
          <Button color="primary" className="rounded-none" onPress={() => setIsCreateWorkspaceOpen(true)}>
            Crear espacio
          </Button>
        }
      />

      {isLoading ? (
        <div className="border-2 border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Cargando espacios de trabajo...</p>
        </div>
      ) : workspacePreviews.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspacePreviews.map(({ workspace, members }) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              members={members}
              isCurrent={activeWorkspace?.id === workspace.id}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="Sin espacios de trabajo"
          description="No tienes espacios aún. Crea el primero para comenzar."
          action={{ label: "Crear espacio", onClick: () => setIsCreateWorkspaceOpen(true) }}
        />
      )}

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onCreate={handleCreateWorkspace}
        isLoading={createWorkspaceMutation.isPending}
      />
    </div>
  );
}
