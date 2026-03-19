import { Button } from "@heroui/react";
import { FolderOpen } from "lucide-react";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProjectList } from "@/features/projects/components/ProjectList";
import { useProjects } from "@/features/projects/hooks/useProjects";

export default function WorkspaceDashboardPage() {
  const { workspaceSlug = "ws-demo" } = useParams();
  const { data: projects = [] } = useProjects(workspaceSlug);

  return (
    <div>
      <PageHeader
        title="Workspace Dashboard"
        subtitle={`Workspace: ${workspaceSlug}`}
        actions={<Button color="primary">Nuevo proyecto</Button>}
      />
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Sin proyectos aun"
          description="Crea tu primer proyecto para comenzar"
          action={{ label: "Nuevo proyecto", onClick: () => undefined }}
        />
      ) : (
        <ProjectList projects={projects} />
      )}
    </div>
  );
}
