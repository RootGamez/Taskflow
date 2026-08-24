import { apiClient } from "@/lib/axios";
import type {
  InviteWorkspaceMemberPayload,
  UpdateWorkspaceMemberRolePayload,
  WorkspaceInvitationSummary,
  WorkspaceMember,
} from "@/features/members/types/member.types";

export async function getWorkspaceMembers(workspaceSlug: string): Promise<WorkspaceMember[]> {
  const { data } = await apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceSlug}/members/`);
  return data;
}

export async function inviteWorkspaceMember(
  workspaceSlug: string,
  payload: InviteWorkspaceMemberPayload,
): Promise<WorkspaceInvitationSummary> {
  const { data } = await apiClient.post<WorkspaceInvitationSummary>(`/workspaces/${workspaceSlug}/members/`, payload);
  return data;
}

export async function getWorkspaceInvitations(workspaceSlug: string): Promise<WorkspaceInvitationSummary[]> {
  const { data } = await apiClient.get<WorkspaceInvitationSummary[]>(`/workspaces/${workspaceSlug}/invitations/`);
  return data;
}

export async function cancelWorkspaceInvitation(
  workspaceSlug: string,
  invitationId: string,
): Promise<WorkspaceInvitationSummary> {
  const { data } = await apiClient.delete<WorkspaceInvitationSummary>(
    `/workspaces/${workspaceSlug}/invitations/${invitationId}/`,
  );
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
