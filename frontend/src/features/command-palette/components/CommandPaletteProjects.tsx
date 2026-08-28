import { CommandGroup, CommandItem } from "@/components/ui/shadcn/command";
import { filterCommandItems } from "@/features/command-palette/lib/filterCommandItems";
import type { Project } from "@/features/projects/types/project.types";

interface CommandPaletteProjectsProps {
  /** Cache de `useProjects(workspaceSlug)` (D23) -- sin fetch propio. */
  projects: Project[];
  workspaceSlug: string;
  query: string;
  onNavigate: (path: string) => void;
  closePalette: () => void;
}

/**
 * Grupo "Proyectos" del palette. Limitacion conocida y documentada (D23):
 * solo lista los proyectos del workspace activo -- no existe (todavia) un
 * endpoint de proyectos cross-workspace. La navegacion cross-workspace se
 * hace desde el grupo "Espacios".
 */
export function CommandPaletteProjects({
  projects,
  workspaceSlug,
  query,
  onNavigate,
  closePalette,
}: CommandPaletteProjectsProps) {
  const visibleProjects = filterCommandItems(projects, query, (project) => project.name);

  if (visibleProjects.length === 0) {
    return null;
  }

  return (
    <CommandGroup heading="Proyectos">
      {visibleProjects.map((project) => (
        <CommandItem
          key={project.id}
          value={`project-${project.id}`}
          onSelect={() => {
            closePalette();
            onNavigate(`/workspaces/${workspaceSlug}/projects/${project.id}/board`);
          }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
          <span className="truncate">{project.name}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
