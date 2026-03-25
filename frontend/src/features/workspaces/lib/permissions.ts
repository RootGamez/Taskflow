import type { Workspace } from "@/features/workspaces/types/workspace.types";

const MUTATION_ROLES: ReadonlyArray<Workspace["role"]> = ["owner", "admin", "member"];

export function canMutateWorkspace(role: Workspace["role"] | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return MUTATION_ROLES.includes(role);
}
