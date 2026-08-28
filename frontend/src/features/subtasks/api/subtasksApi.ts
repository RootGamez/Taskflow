import type {
  CreateSubtaskPayload,
  SubTask,
  UpdateSubtaskPayload,
} from "@/features/subtasks/types/subtask.types";
import { apiClient } from "@/lib/axios";

export async function getSubtasks(projectId: string, ticketId: string): Promise<SubTask[]> {
  const { data } = await apiClient.get<SubTask[]>(
    `/projects/${projectId}/tickets/${ticketId}/subtasks/`,
  );
  return data;
}

export async function createSubtask(
  projectId: string,
  ticketId: string,
  payload: CreateSubtaskPayload,
): Promise<SubTask> {
  const { data } = await apiClient.post<SubTask>(
    `/projects/${projectId}/tickets/${ticketId}/subtasks/`,
    payload,
  );
  return data;
}

export async function updateSubtask(
  projectId: string,
  ticketId: string,
  subtaskId: string,
  payload: UpdateSubtaskPayload,
): Promise<SubTask> {
  const { data } = await apiClient.patch<SubTask>(
    `/projects/${projectId}/tickets/${ticketId}/subtasks/${subtaskId}/`,
    payload,
  );
  return data;
}

export async function deleteSubtask(
  projectId: string,
  ticketId: string,
  subtaskId: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/tickets/${ticketId}/subtasks/${subtaskId}/`);
}
