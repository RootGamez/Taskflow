import type { Label } from "@/features/tickets/types/ticket.types";
import { apiClient } from "@/lib/axios";

interface CreateLabelPayload {
  name: string;
  color: string;
}

export async function getLabelsByProject(projectId: string): Promise<Label[]> {
  const { data } = await apiClient.get<Label[]>(`/projects/${projectId}/labels/`);
  return data;
}

export async function createLabel(projectId: string, payload: CreateLabelPayload): Promise<Label> {
  const { data } = await apiClient.post<Label>(`/projects/${projectId}/labels/`, payload);
  return data;
}

export async function deleteLabel(projectId: string, labelId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/labels/${labelId}/`);
}
