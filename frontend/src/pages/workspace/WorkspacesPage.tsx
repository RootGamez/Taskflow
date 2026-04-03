import { Button, Card, CardBody } from "@heroui/react";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

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
      toast.success("Workspace creado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el workspace"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Todos los workspaces"
        subtitle="Explora tus espacios de trabajo y abre cualquiera en un clic."
        actions={
          <Button color="primary" onPress={() => setIsCreateWorkspaceOpen(true)}>
            Crear workspace
          </Button>
        }
      />

      {isLoading ? (
        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody>
            <p className="text-sm text-zinc-500">Cargando workspaces...</p>
          </CardBody>
        </Card>
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
        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody>
            <p className="text-sm text-zinc-500">No tienes workspaces aún. Crea el primero para comenzar.</p>
          </CardBody>
        </Card>
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