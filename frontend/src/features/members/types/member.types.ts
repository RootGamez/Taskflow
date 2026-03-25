export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: WorkspaceRole;
  is_active: boolean;
  created_at: string;
}

export interface InviteWorkspaceMemberPayload {
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
}

export interface UpdateWorkspaceMemberRolePayload {
  role: Exclude<WorkspaceRole, "owner">;
}

export interface WorkspaceInvitationSummary {
  id: string;
  workspace_id: string;
  invited_user_id: string;
  invited_user_email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}
