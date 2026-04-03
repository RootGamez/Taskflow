import { Button } from "@heroui/react";
import { FolderOpen } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal";
import { ProjectDeleteDialog } from "@/features/projects/components/ProjectDeleteDialog";
import { ProjectList } from "@/features/projects/components/ProjectList";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useToggleProjectArchive,
  useUpdateProject,
} from "@/features/projects/hooks/useProjects";
import type { Project } from "@/features/projects/types/project.types";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function WorkspaceDashboardPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const { data: projects = [] } = useProjects(workspaceSlug);
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const toggleProjectArchiveMutation = useToggleProjectArchive();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const canMutate = canMutateWorkspace(activeWorkspace?.role);

  const handleCreateProject = async (input: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    if (!canMutate) {
      toast.error("No tienes permisos para crear proyectos en este workspace");
      return;
    }

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

  const handleUpdateProject = async (input: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    if (!canMutate || !projectToEdit) {
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        workspaceSlug,
        projectId: projectToEdit.id,
        ...input,
      });
      setProjectToEdit(null);
      toast.success("Proyecto actualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el proyecto"));
    }
  };

  const handleToggleArchiveProject = async (project: Project) => {
    if (!canMutate) {
      return;
    }

    try {
      await toggleProjectArchiveMutation.mutateAsync({
        workspaceSlug,
        projectId: project.id,
        isArchived: !project.is_archived,
      });
      toast.success(project.is_archived ? "Proyecto desarchivado" : "Proyecto archivado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el estado del proyecto"));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!canMutate) {
      return;
    }

    try {
      await deleteProjectMutation.mutateAsync({ workspaceSlug, projectId });
      setProjectToDelete(null);
      toast.success("Proyecto eliminado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el proyecto"));
    }
  };

  return (
    <div>
      <PageHeader
        title="Workspace Dashboard"
        subtitle={`Workspace: ${workspaceSlug}`}
        actions={canMutate ? <Button color="primary" onPress={() => setCreateModalOpen(true)}>Nuevo proyecto</Button> : undefined}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin proyectos aun"
          description="Crea tu primer proyecto para comenzar"
          action={canMutate ? { label: "Nuevo proyecto", onClick: () => setCreateModalOpen(true) } : undefined}
        />
      ) : (
        <ProjectList
          projects={projects}
          workspaceSlug={workspaceSlug}
          onEdit={setProjectToEdit}
          onToggleArchive={handleToggleArchiveProject}
          onDelete={setProjectToDelete}
          isActionLoading={updateProjectMutation.isPending || deleteProjectMutation.isPending || toggleProjectArchiveMutation.isPending}
        />
      )}

      <CreateProjectModal
        isOpen={isCreateModalOpen && canMutate}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateProject}
        isLoading={createProjectMutation.isPending}
      />

      <CreateProjectModal
        isOpen={Boolean(projectToEdit) && canMutate}
        onClose={() => setProjectToEdit(null)}
        onSubmit={handleUpdateProject}
        isLoading={updateProjectMutation.isPending}
        title="Editar proyecto"
        description="Actualiza el nombre, la descripcion y el color del proyecto."
        submitLabel="Guardar cambios"
        initialValues={projectToEdit ? {
          name: projectToEdit.name,
          description: projectToEdit.description ?? "",
          color: projectToEdit.color,
        } : undefined}
      />

      <ProjectDeleteDialog
        project={projectToDelete}
        isOpen={Boolean(projectToDelete) && canMutate}
        onClose={() => setProjectToDelete(null)}
        onDelete={handleDeleteProject}
        isLoading={deleteProjectMutation.isPending}
      />
    </div>
  );
}
