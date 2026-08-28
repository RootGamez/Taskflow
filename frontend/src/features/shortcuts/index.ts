export { GlobalShortcutsProvider } from "@/features/shortcuts/components/GlobalShortcutsProvider";
export { KeyboardShortcutsDialog } from "@/features/shortcuts/components/KeyboardShortcutsDialog";
export { useGlobalShortcuts } from "@/features/shortcuts/hooks/useGlobalShortcuts";
export { useRegisterCommandAction } from "@/features/shortcuts/hooks/useRegisterCommandAction";
export { isTypingTarget } from "@/features/shortcuts/lib/isTypingTarget";
export { matchShortcut, INITIAL_CHORD_STATE } from "@/features/shortcuts/lib/matchShortcut";
export type { ChordState, ShortcutActionId, ShortcutKeyEvent } from "@/features/shortcuts/lib/matchShortcut";
export {
  SHORTCUT_REGISTRY,
  SHORTCUT_GROUPS,
  formatShortcutKeys,
  getModifierKeyLabel,
} from "@/features/shortcuts/lib/shortcutRegistry";
export type { ShortcutGroup, ShortcutRegistryEntry } from "@/features/shortcuts/lib/shortcutRegistry";
export { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";
