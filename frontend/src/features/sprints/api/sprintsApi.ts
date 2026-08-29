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

const base = (workspaceSlug: string) => `/workspaces/${workspaceSlug}/sprints/`;

export async function getSprintsByWorkspace(workspaceSlug: string): Promise<Sprint[]> {
  const { data } = await apiClient.get<Sprint[]>(base(workspaceSlug));
  return data;
}

export async function createSprint(workspaceSlug: string, payload: CreateSprintPayload): Promise<Sprint> {
  const { data } = await apiClient.post<Sprint>(base(workspaceSlug), payload);
  return data;
}

export async function updateSprint(
  workspaceSlug: string,
  sprintId: string,
  payload: UpdateSprintPayload,
): Promise<Sprint> {
  const { data } = await apiClient.patch<Sprint>(`${base(workspaceSlug)}${sprintId}/`, payload);
  return data;
}

export async function deleteSprint(workspaceSlug: string, sprintId: string): Promise<void> {
  await apiClient.delete(`${base(workspaceSlug)}${sprintId}/`);
}

export async function activateSprint(workspaceSlug: string, sprintId: string): Promise<Sprint> {
  const { data } = await apiClient.post<Sprint>(`${base(workspaceSlug)}${sprintId}/activate/`);
  return data;
}

export async function completeSprint(workspaceSlug: string, sprintId: string): Promise<Sprint> {
  const { data } = await apiClient.post<Sprint>(`${base(workspaceSlug)}${sprintId}/complete/`);
  return data;
}
