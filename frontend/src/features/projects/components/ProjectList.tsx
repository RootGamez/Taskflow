import { ProjectCard } from "@/features/projects/components/ProjectCard";
import type { Project } from "@/features/projects/types/project.types";

interface ProjectListProps {
  projects: Project[];
  workspaceSlug: string;
}

export function ProjectList({ projects, workspaceSlug }: ProjectListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} workspaceSlug={workspaceSlug} />
      ))}
    </div>
  );
}
