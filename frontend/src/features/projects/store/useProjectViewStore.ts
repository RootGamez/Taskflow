import { create } from "zustand";

interface ProjectViewStore {
  searchTerm: string;
  showArchived: boolean;
  setSearchTerm: (searchTerm: string) => void;
  toggleShowArchived: () => void;
  reset: () => void;
}

export const useProjectViewStore = create<ProjectViewStore>((set) => ({
  searchTerm: "",
  showArchived: false,
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  toggleShowArchived: () => set((state) => ({ showArchived: !state.showArchived })),
  reset: () => set({ searchTerm: "", showArchived: false }),
}));