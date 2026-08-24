import { create } from "zustand";

import type { Workspace } from "@/features/workspaces/types/workspace.types";

interface WorkspaceStore {
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (workspace: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  activeWorkspace: null,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
}));
