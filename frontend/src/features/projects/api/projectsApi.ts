import type { Project } from "@/features/projects/types/project.types";
import { apiClient } from "@/lib/axios";

interface CreateProjectPayload {
  name: string;
  description?: string;
  color?: string;
}

export async function getProjectsByWorkspace(workspaceSlug: string): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>(`/workspaces/${workspaceSlug}/projects/`);
  return data;
}

export async function createProject(
  workspaceSlug: string,
  payload: CreateProjectPayload,
): Promise<Project> {
  const { data } = await apiClient.post<Project>(`/workspaces/${workspaceSlug}/projects/`, payload);
  return data;
}

export async function getProjectById(
  workspaceSlug: string,
  projectId: string,
): Promise<Project> {
  const { data } = await apiClient.get<Project>(
    `/workspaces/${workspaceSlug}/projects/${projectId}/`,
  );
  return data;
}
