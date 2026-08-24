import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY, useUIStore } from "@/store/uiStore";
import type { ThemeMode } from "@/types/global.types";

// Re-exportada para que quien consuma este hook tenga a mano la misma
// clave que usa la persistencia (useUIStore es quien efectivamente
// lee/escribe localStorage, para no duplicar la logica de hidratacion aca).
export { THEME_STORAGE_KEY };

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export interface UseThemeModeResult {
  /** El modo elegido por el usuario: "light" | "dark" | "system". */
  theme: ThemeMode;
  /** El tema efectivamente aplicado ("light" | "dark"), ya resuelto el caso "system". */
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
}

function resolveTheme(theme: ThemeMode, prefersDark: boolean): "light" | "dark" {
  if (theme === "system") {
    return prefersDark ? "dark" : "light";
  }

  return theme;
}

/**
 * Fuente unica de verdad para aplicar dark mode real:
 * - Lee/persiste el theme via useUIStore (localStorage).
 * - Resuelve "system" contra prefers-color-scheme.
 * - Se suscribe a cambios del SO en vivo (addEventListener "change"),
 *   asi que si el usuario cambia el tema del SO con la app abierta en modo
 *   "system", la UI reacciona sin necesidad de recargar.
 * - Aplica/quita la clase "dark" en document.documentElement.
 */
export function useThemeMode(): UseThemeModeResult {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  const [prefersDark, setPrefersDark] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(DARK_MEDIA_QUERY).matches : false,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(DARK_MEDIA_QUERY);
    setPrefersDark(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    mediaQueryList.addEventListener("change", handleChange);

    return () => {
      mediaQueryList.removeEventListener("change", handleChange);
    };
  }, []);

  const resolvedTheme = resolveTheme(theme, prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  return { theme, resolvedTheme, setTheme };
}
