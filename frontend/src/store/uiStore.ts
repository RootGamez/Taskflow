import { create } from "zustand";

import type { ThemeMode } from "@/types/global.types";

interface UIStore {
  sidebarCollapsed: boolean;
  theme: ThemeMode;
  activeModal: string | null;
  toggleSidebar: () => void;
  setTheme: (theme: ThemeMode) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  theme: "system",
  activeModal: null,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
}));
