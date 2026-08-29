import { create } from "zustand";

import type { ThemeMode } from "@/types/global.types";

// Si renombrás esta clave, actualizá también el script anti-FOUC en
// frontend/index.html (STORAGE_KEY) — es HTML estático, no puede importar
// esta constante.
export const THEME_STORAGE_KEY = "taskflow.theme";

const VALID_THEMES: readonly ThemeMode[] = ["light", "dark", "system"];

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (VALID_THEMES as readonly string[]).includes(value);
}

/**
 * Lee el theme persistido en localStorage. Pura y defensiva: nunca lanza
 * (el modo privado de algunos navegadores puede tirar al leer localStorage)
 * y cae a "system" si no hay valor guardado o si el valor es invalido/corrupto.
 */
export function getInitialTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function persistTheme(theme: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Modo privado o localStorage deshabilitado: el theme sigue funcionando
    // en memoria para la sesion actual, simplemente no persiste.
  }
}

interface UIStore {
  sidebarCollapsed: boolean;
  /** Drawer de navegación en móvil/tablet (`< lg`). No persiste. */
  mobileNavOpen: boolean;
  theme: ThemeMode;
  activeModal: string | null;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  theme: getInitialTheme(),
  activeModal: null,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
}));
