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
  "src/features/comments/**",
  "src/features/activities/**",
  "src/features/notifications/lib/**",
  "src/features/notifications/components/**",
  // Fase 2 (Calendario): agregado por el agente de la feature de calendario
  // porque todavía no estaba cuando arrancó su trabajo — única excepción
  // acordada a "no tocar este archivo" en el resto de la Fase 2.
  "src/features/calendar/**",
  "src/features/sprints/**",
  "src/features/mytasks/**",
  "src/features/labels/**",
  // Fase 3 (Command Palette, Busqueda, Subtareas, Relaciones, Atajos):
  // agregado por WP-0 para que los 3 agentes de Wave 1 y el de Wave 2
  // hereden el umbral desde su primer commit, sin tener que tocar este
  // archivo compartido ellos mismos (I7 de docs/PHASE_3_PLAN.md).
  "src/features/search/**",
  "src/features/command-palette/**",
  "src/features/subtasks/**",
  "src/features/relations/**",
  "src/features/shortcuts/**",
  // Solo los 2 stores nuevos de WP-0 (D7/D8), no "src/store/**" entero:
  // authStore.ts/workspaceStore.ts no tienen tests propios y meterlos
  // aca haria caer el promedio de cobertura por debajo del 80% (mismo
  // motivo por el que arriba solo esta "src/store/uiStore.ts", no todo
  // el directorio).
  "src/store/commandPaletteStore.ts",
  "src/store/commandActionsStore.ts",
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
