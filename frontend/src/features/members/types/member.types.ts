// "removed" no es un rol real que se pueda elegir en un select -- es el
// estado que deja el soft-delete al eliminar a alguien del espacio (ver
// WorkspaceMember.Role.REMOVED en el backend): la fila sobrevive para no
// dejar tickets huerfanos, listada aparte en "Miembros eliminados".
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer" | "removed";

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
  role: Exclude<WorkspaceRole, "owner" | "removed">;
}

export interface UpdateWorkspaceMemberRolePayload {
  role: Exclude<WorkspaceRole, "owner" | "removed">;
}

export interface WorkspaceInvitationSummary {
  id: string;
  workspace_id: string;
  invited_user_id: string;
  invited_user_email: string;
  invited_by_id: string;
  invited_by_email: string;
  invitation_token: string;
  role: Exclude<WorkspaceRole, "owner" | "removed">;
  status: "pending" | "accepted" | "rejected" | "cancelled" | "expired";
  created_at: string;
  expires_at: string;
}
