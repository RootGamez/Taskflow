import { create } from "zustand";

import type { DateFilterPreset, TicketDateFilter } from "@/features/tickets/types/dateFilter.types";

interface TicketFilterStore {
  dateFilter: TicketDateFilter;
  setPreset: (preset: DateFilterPreset) => void;
  setCustomRange: (from: string | null, to: string | null) => void;
  clear: () => void;
}

const INITIAL_DATE_FILTER: TicketDateFilter = { preset: "all", from: null, to: null };

// Store dedicado a filtros de tickets (dominio distinto de
// useProjectViewStore, que es de proyectos). Sin persistencia: un filtro
// pegajoso entre proyectos confunde.
export const useTicketFilterStore = create<TicketFilterStore>((set) => ({
  dateFilter: INITIAL_DATE_FILTER,
  setPreset: (preset) => set({ dateFilter: { preset, from: null, to: null } }),
  setCustomRange: (from, to) => set({ dateFilter: { preset: "custom", from, to } }),
  clear: () => set({ dateFilter: INITIAL_DATE_FILTER }),
}));
