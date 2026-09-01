import type { WorkspaceRole } from "@/features/members/types/member.types";
import type { Workspace } from "@/features/workspaces/types/workspace.types";

const MUTATION_ROLES: ReadonlyArray<Workspace["role"]> = ["owner", "admin", "member"];
const MEMBER_MANAGEMENT_ROLES: ReadonlyArray<Workspace["role"]> = ["owner", "admin"];

export function canMutateWorkspace(role: Workspace["role"] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return MUTATION_ROLES.includes(role);
}

export function canManageWorkspaceMembers(role: Workspace["role"] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return MEMBER_MANAGEMENT_ROLES.includes(role);
}

/**
 * Espeja las reglas del backend (`WorkspaceMemberDetailView.delete`) para no
 * ofrecer un boton que la API va a rechazar: solo owner/admin gestionan
 * miembros, al owner no se le puede echar, nadie se elimina a si mismo desde
 * aca, un admin no puede eliminar a otro admin (solo el owner puede), y a
 * alguien ya eliminado (soft-delete, role="removed") no se lo vuelve a
 * eliminar -- la unica forma de restaurarlo es invitandolo de nuevo.
 */
export function canRemoveWorkspaceMember({
  requesterRole,
  targetRole,
  isSelf,
}: {
  requesterRole: Workspace["role"] | null | undefined;
  targetRole: WorkspaceRole;
  isSelf: boolean;
}): boolean {
  if (!canManageWorkspaceMembers(requesterRole)) {
    return false;
  }
  if (isSelf || targetRole === "owner" || targetRole === "removed") {
    return false;
  }
  return !(requesterRole === "admin" && targetRole === "admin");
}
