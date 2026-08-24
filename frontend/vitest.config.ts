import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Cobertura acotada al código nuevo de la Fase 1 (diseño + filtros de fecha).
// No se pone umbral global: el repo no tenía tests antes de esto y un umbral
// global rompería CI sobre código preexistente sin cobertura.
const COVERED_PATHS = [
  "src/features/tickets/utils/**",
  "src/features/tickets/store/**",
  "src/features/tickets/lib/**",
  "src/features/tickets/components/TicketDateFilter.tsx",
  "src/features/tickets/components/TicketCard.tsx",
  "src/hooks/useThemeMode.ts",
  "src/store/uiStore.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    // El pool por defecto ("forks") cuelga en este entorno sandboxeado
    // (bloquea el fork de child_process). "threads" funciona sin cambios.
    pool: "threads",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: COVERED_PATHS,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
