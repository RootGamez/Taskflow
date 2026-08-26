import type { Sprint } from "@/features/sprints/types/sprint.types";
import { apiClient } from "@/lib/axios";

export interface CreateSprintPayload {
  name: string;
  start_date: string;
  end_date: string;
  goal?: string;
}

export interface UpdateSprintPayload {
  name?: string;
  start_date?: string;
  end_date?: string;
  goal?: string;
}

export async function getSprintsByProject(projectId: string): Promise<Sprint[]> {
  const { data } = await apiClient.get<Sprint[]>(`/projects/${projectId}/sprints/`);
  return data;
}

export async function createSprint(projectId: string, payload: CreateSprintPayload): Promise<Sprint> {
  const { data } = await apiClient.post<Sprint>(`/projects/${projectId}/sprints/`, payload);
  return data;
}

export async function updateSprint(
  projectId: string,
  sprintId: string,
  payload: UpdateSprintPayload,
): Promise<Sprint> {
  const { data } = await apiClient.patch<Sprint>(`/projects/${projectId}/sprints/${sprintId}/`, payload);
  return data;
}

export async function deleteSprint(projectId: string, sprintId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/sprints/${sprintId}/`);
}

export async function activateSprint(projectId: string, sprintId: string): Promise<Sprint> {
  const { data } = await apiClient.post<Sprint>(`/projects/${projectId}/sprints/${sprintId}/activate/`);
  return data;
}

export async function completeSprint(projectId: string, sprintId: string): Promise<Sprint> {
  const { data } = await apiClient.post<Sprint>(`/projects/${projectId}/sprints/${sprintId}/complete/`);
  return data;
}
