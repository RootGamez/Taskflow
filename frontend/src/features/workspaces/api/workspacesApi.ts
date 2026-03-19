import type { Workspace } from "@/features/workspaces/types/workspace.types";

const MOCK_WORKSPACES: Workspace[] = [
  {
    id: "ws-1",
    name: "TaskFlow Studio",
    slug: "ws-demo",
    logo_url: null,
    owner_id: "u-1",
    created_at: new Date().toISOString(),
    role: "owner",
  },
  {
    id: "ws-2",
    name: "Marketing Ops",
    slug: "marketing-ops",
    logo_url: null,
    owner_id: "u-2",
    created_at: new Date().toISOString(),
    role: "member",
  },
];

export async function getWorkspaces(): Promise<Workspace[]> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return MOCK_WORKSPACES;
}
