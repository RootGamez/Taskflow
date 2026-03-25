import { apiClient } from "@/lib/axios";
import type {
  InviteWorkspaceMemberPayload,
  UpdateWorkspaceMemberRolePayload,
  WorkspaceMember,
} from "@/features/members/types/member.types";

export async function getWorkspaceMembers(workspaceSlug: string): Promise<WorkspaceMember[]> {
  const { data } = await apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceSlug}/members/`);
  return data;
}

export async function inviteWorkspaceMember(
  workspaceSlug: string,
  payload: InviteWorkspaceMemberPayload,
): Promise<WorkspaceMember> {
  const { data } = await apiClient.post<WorkspaceMember>(`/workspaces/${workspaceSlug}/members/`, payload);
  return data;
}

export async function updateWorkspaceMemberRole(
  workspaceSlug: string,
  memberId: string,
  payload: UpdateWorkspaceMemberRolePayload,
): Promise<WorkspaceMember> {
  const { data } = await apiClient.patch<WorkspaceMember>(
    `/workspaces/${workspaceSlug}/members/${memberId}/`,
    payload,
  );
  return data;
}
