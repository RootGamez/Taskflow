import { create } from "zustand";

import type { SprintScope } from "@/features/sprints/types/sprint.types";

interface SprintScopeStore {
  scope: SprintScope;
  setScope: (scope: SprintScope) => void;
  clear: () => void;
}

const INITIAL_SCOPE: SprintScope = { kind: "all" };

// Store dedicado al scope de sprint (dominio distinto de useTicketFilterStore,
// que es de fecha). Sin persistencia: se resetea por projectId (D6), igual
// que useTicketFilterStore.
export const useSprintScopeStore = create<SprintScopeStore>((set) => ({
  scope: INITIAL_SCOPE,
  setScope: (scope) => set({ scope }),
  clear: () => set({ scope: INITIAL_SCOPE }),
}));
