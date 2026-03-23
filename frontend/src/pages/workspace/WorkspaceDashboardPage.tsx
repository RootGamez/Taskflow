import { Button } from "@heroui/react";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal";
import { ProjectList } from "@/features/projects/components/ProjectList";
import { useCreateProject, useProjects } from "@/features/projects/hooks/useProjects";
import { getApiErrorMessage } from "@/lib/errors";

export default function WorkspaceDashboardPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo" } = useParams();
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const { data: projects = [] } = useProjects(workspaceSlug);
  const createProjectMutation = useCreateProject();

  const handleCreateProject = async (input: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    try {
      const project = await createProjectMutation.mutateAsync({
        workspaceSlug,
        ...input,
      });
      setCreateModalOpen(false);
      toast.success("Proyecto creado");
      navigate(`/workspaces/${workspaceSlug}/projects/${project.id}/board`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el proyecto"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Workspace Dashboard"
        subtitle={`Workspace: ${workspaceSlug}`}
        actions={<Button color="primary" onPress={() => setCreateModalOpen(true)}>Nuevo proyecto</Button>}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin proyectos aun"
          description="Crea tu primer proyecto para comenzar"
          action={{ label: "Nuevo proyecto", onClick: () => setCreateModalOpen(true) }}
        />
      ) : (
        <ProjectList projects={projects} />
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateProject}
        isLoading={createProjectMutation.isPending}
      />
    </div>
  );
}
