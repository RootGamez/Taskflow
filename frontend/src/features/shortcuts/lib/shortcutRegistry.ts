/**
 * Fuente de verdad declarativa de los atajos v1 (D54 de
 * docs/PHASE_3_PLAN.md). El panel de ayuda (`KeyboardShortcutsDialog`) se
 * renderiza a partir de este array -- nunca se escribe a mano -- para que
 * nunca pueda mentir sobre los atajos reales (RD10).
 *
 * `keys` usa tokens platform-agnosticos ("mod" para Cmd/Ctrl, teclas en
 * minuscula para el resto). `formatShortcutKeys` los traduce a la
 * representacion visual segun la plataforma.
 */
export const SHORTCUT_GROUPS = ["General", "Navegación", "Acciones"] as const;

export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

export interface ShortcutRegistryEntry {
  id: string;
  keys: string[];
  label: string;
  group: ShortcutGroup;
}

export const SHORTCUT_REGISTRY: ShortcutRegistryEntry[] = [
  {
    id: "toggle-command-palette",
    keys: ["mod", "k"],
    label: "Abrir o cerrar el buscador rapido",
    group: "General",
  },
  {
    id: "open-help",
    keys: ["?"],
    label: "Abrir este panel de ayuda",
    group: "General",
  },
  {
    id: "close-dialog",
    keys: ["esc"],
    label: "Cerrar el dialogo abierto",
    group: "General",
  },
  {
    id: "create-ticket",
    keys: ["c"],
    label: "Crear ticket",
    group: "Acciones",
  },
  {
    id: "go-dashboard",
    keys: ["g", "d"],
    label: "Ir al Dashboard",
    group: "Navegación",
  },
  {
    id: "go-my-tasks",
    keys: ["g", "m"],
    label: "Ir a Mis tareas",
    group: "Navegación",
  },
  {
    id: "go-workspaces",
    keys: ["g", "p"],
    label: "Ir a Espacios",
    group: "Navegación",
  },
];

const KEY_DISPLAY_LABELS: Record<string, string> = {
  k: "K",
  c: "C",
  g: "G",
  d: "D",
  m: "M",
  p: "P",
  "?": "?",
  esc: "Esc",
};

/**
 * Deteccion de plataforma inyectable (D54/D61 -- ultimo parametro con
 * default, nunca lee `navigator.platform` fuera de este modulo). Permite
 * tests deterministas sin mockear globals.
 */
export function getModifierKeyLabel(platform: string = getRuntimePlatform()): string {
  return /mac/i.test(platform) ? "Cmd" : "Ctrl";
}

export function formatShortcutKeys(keys: string[], platform: string = getRuntimePlatform()): string[] {
  const modifierLabel = getModifierKeyLabel(platform);

  return keys.map((key) => (key === "mod" ? modifierLabel : (KEY_DISPLAY_LABELS[key] ?? key.toUpperCase())));
}

function getRuntimePlatform(): string {
  return typeof navigator !== "undefined" && typeof navigator.platform === "string" ? navigator.platform : "";
}
