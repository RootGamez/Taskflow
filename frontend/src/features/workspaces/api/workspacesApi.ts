import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { apiClient } from "@/lib/axios";

interface CreateWorkspacePayload {
  name: string;
  slug?: string;
  logo_url?: string;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const { data } = await apiClient.get<Workspace[]>("/workspaces/");
  return data;
}

export async function createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace> {
  const { data } = await apiClient.post<Workspace>("/workspaces/", payload);
  return data;
}

export async function selectActiveWorkspace(workspaceId: string): Promise<Workspace> {
  const { data } = await apiClient.post<Workspace>("/workspaces/select-active/", {
    workspace_id: workspaceId,
  });
  return data;
}
