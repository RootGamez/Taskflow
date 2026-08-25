import { apiClient } from "@/lib/axios";
import type {
  Comment,
  CreateCommentPayload,
  UpdateCommentPayload,
} from "@/features/comments/types/comment.types";

export async function getComments(projectId: string, ticketId: string): Promise<Comment[]> {
  const { data } = await apiClient.get<Comment[]>(
    `/projects/${projectId}/tickets/${ticketId}/comments/`,
  );
  return data;
}

export async function createComment(
  projectId: string,
  ticketId: string,
  payload: CreateCommentPayload,
): Promise<Comment> {
  const { data } = await apiClient.post<Comment>(
    `/projects/${projectId}/tickets/${ticketId}/comments/`,
    payload,
  );
  return data;
}

export async function updateComment(
  projectId: string,
  ticketId: string,
  commentId: string,
  payload: UpdateCommentPayload,
): Promise<Comment> {
  const { data } = await apiClient.patch<Comment>(
    `/projects/${projectId}/tickets/${ticketId}/comments/${commentId}/`,
    payload,
  );
  return data;
}

export async function deleteComment(
  projectId: string,
  ticketId: string,
  commentId: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/tickets/${ticketId}/comments/${commentId}/`);
}
