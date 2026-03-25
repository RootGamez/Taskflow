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
