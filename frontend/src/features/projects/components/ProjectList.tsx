import { Button } from "@heroui/react";
import { Eye, EyeOff, Search } from "lucide-react";

import { Input } from "@/components/ui/shadcn/input";
import { ProjectCard } from "@/features/projects/components/ProjectCard";
import { useProjectViewStore } from "@/features/projects/store/useProjectViewStore";
import type { Project } from "@/features/projects/types/project.types";

interface ProjectListProps {
  projects: Project[];
  workspaceSlug: string;
  onEdit: (project: Project) => void;
  onToggleArchive: (project: Project) => void;
  onDelete: (project: Project) => void;
  isActionLoading?: boolean;
}

export function ProjectList({
  projects,
  workspaceSlug,
  onEdit,
  onToggleArchive,
  onDelete,
  isActionLoading = false,
}: ProjectListProps) {
  const searchTerm = useProjectViewStore((state) => state.searchTerm);
  const showArchived = useProjectViewStore((state) => state.showArchived);
  const setSearchTerm = useProjectViewStore((state) => state.setSearchTerm);
  const toggleShowArchived = useProjectViewStore((state) => state.toggleShowArchived);

  const filteredProjects = projects
    .filter((project) => (showArchived ? true : !project.is_archived))
    .filter((project) => {
      if (!searchTerm.trim()) {
        return true;
      }

      const normalizedSearch = searchTerm.trim().toLowerCase();
      return [project.name, project.description, project.color]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch));
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-2 border-border bg-secondary p-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar proyecto"
            className="h-9 pl-9"
          />
        </div>
        <Button
          size="sm"
          variant="light"
          className="rounded-none"
          onPress={toggleShowArchived}
          startContent={showArchived ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        >
          {showArchived ? "Ocultar archivados" : "Ver archivados"}
        </Button>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              workspaceSlug={workspaceSlug}
              onEdit={onEdit}
              onToggleArchive={onToggleArchive}
              onDelete={onDelete}
              isActionLoading={isActionLoading}
            />
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-border p-6 text-sm text-muted-foreground">
          No hay proyectos que coincidan con el filtro actual.
        </div>
      )}
    </div>
  );
}
