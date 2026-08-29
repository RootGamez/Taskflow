import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import { apiClient } from "@/lib/axios";

export interface CreateStatusPayload {
  name: string;
  color?: string;
  is_done?: boolean;
}

export interface UpdateStatusPayload {
  name?: string;
  color?: string;
  order?: number;
  is_done?: boolean;
}

const base = (workspaceSlug: string) => `/workspaces/${workspaceSlug}/statuses/`;

export async function getWorkspaceStatuses(workspaceSlug: string): Promise<WorkspaceStatus[]> {
  const { data } = await apiClient.get<WorkspaceStatus[]>(base(workspaceSlug));
  return data;
}

export async function createStatus(
  workspaceSlug: string,
  payload: CreateStatusPayload,
): Promise<WorkspaceStatus> {
  const { data } = await apiClient.post<WorkspaceStatus>(base(workspaceSlug), payload);
  return data;
}

export async function updateStatus(
  workspaceSlug: string,
  statusId: string,
  payload: UpdateStatusPayload,
): Promise<WorkspaceStatus> {
  const { data } = await apiClient.patch<WorkspaceStatus>(`${base(workspaceSlug)}${statusId}/`, payload);
  return data;
}

export async function deleteStatus(workspaceSlug: string, statusId: string): Promise<void> {
  await apiClient.delete(`${base(workspaceSlug)}${statusId}/`);
}
