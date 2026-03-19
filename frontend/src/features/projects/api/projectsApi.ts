import type { Project } from "@/features/projects/types/project.types";

const MOCK_PROJECTS: Project[] = [
  {
    id: "p-1",
    workspace_id: "ws-1",
    name: "Platform Revamp",
    description: "Mejora de UX y performance de la plataforma principal",
    color: "#2563EB",
    is_archived: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "p-2",
    workspace_id: "ws-1",
    name: "Mobile Beta",
    description: "Preparación de lanzamiento beta para móvil",
    color: "#10B981",
    is_archived: false,
    created_at: new Date().toISOString(),
  },
];

export async function getProjectsByWorkspace(_workspaceSlug: string): Promise<Project[]> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return MOCK_PROJECTS;
}
