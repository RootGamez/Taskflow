"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SlashCommandItem } from "../extensions/SlashExtension";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { createTapSelectHandlers } from "./tapSelect";
import { EditorMenuSurface } from "./EditorMenuSurface";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlashMenuState {
  props: SuggestionProps<SlashCommandItem> | null;
  isVisible: boolean;
  /** Imperative ref to the component's keyboard handler — set by the component */
  keyDownHandler: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>;
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect: (() => DOMRect | null) | null | undefined;
  isVisible: boolean;
  /** Ref that the suggestion renderer uses to call our keyboard handler */
  keyDownHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>;
  /** Portal container (el `[data-slot='dialog-content']` si aplica). */
  container?: HTMLElement | null;
  /** Se llama cuando Radix pide cerrar (Esc / clic fuera). */
  onDismiss?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlashCommandMenu({
  items,
  command,
  clientRect,
  isVisible,
  keyDownHandlerRef,
  container,
  onDismiss,
}: SlashCommandMenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number } | null>(null);
  const isMobile = useIsMobile();
  const pressRef = useRef<{ index: number; x: number; y: number; time: number } | null>(null);

  // Group items by category
  const grouped = useMemo(() => {
    const groups: { label: string; items: SlashCommandItem[] }[] = [];
    const basic = items.filter((o) => o.group === "basic");
    const lists = items.filter((o) => o.group === "lists");
    const advanced = items.filter((o) => o.group === "advanced");
    const media = items.filter((o) => o.group === "media");
    if (basic.length) groups.push({ label: "Básico", items: basic });
    if (lists.length) groups.push({ label: "Listas", items: lists });
    if (advanced.length) groups.push({ label: "Avanzado", items: advanced });
    if (media.length) groups.push({ label: "Media", items: media });
    return groups;
  }, [items]);

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Reset active index when items change
  useEffect(() => {
    setActiveIndex(0);
  }, [items]);

  // El ancla es el rect del cursor que entrega @tiptap/suggestion. Radix
  // Popper se encarga del flip/colisión — ya no hay menuHeight mágico.
  useEffect(() => {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;
    setAnchorRect({ top: rect.bottom, left: rect.left });
  }, [clientRect, items]);

  // Keyboard handler — exposed via ref so the suggestion renderer can call it
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.key === "ArrowDown") {
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter") {
        const selected = flatItems[activeIndex];
        if (selected) command(selected);
        return true;
      }
      return false;
    },
    [activeIndex, flatItems, command]
  );

  // Keep the ref in sync with the latest handler
  useEffect(() => {
    keyDownHandlerRef.current = handleKeyDown;
  }, [handleKeyDown, keyDownHandlerRef]);

  // Cleanup ref on unmount
  useEffect(() => {
    return () => {
      keyDownHandlerRef.current = null;
    };
  }, [keyDownHandlerRef]);

  // Auto-scroll active item into view
  useEffect(() => {
    const el = document.querySelector(
      `[data-slash-index="${activeIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isVisible || flatItems.length === 0) return null;

  let globalIndex = 0;

  return (
    <EditorMenuSurface
      open
      onOpenChange={(next) => {
        if (!next) onDismiss?.();
      }}
      anchorRect={anchorRect}
      container={container}
      autoFocus={false}
      ariaLabel="Insertar bloque"
      desktopMaxHeightClass="max-h-72"
    >
      {grouped.map((group) => (
        <div key={group.label} className="mb-1">
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((item) => {
            const idx = globalIndex++;
            const Icon = item.icon;
            const tap = createTapSelectHandlers(idx, () => command(flatItems[idx]), pressRef);
            return (
              <button
                key={item.id}
                data-slash-index={idx}
                type="button"
                role="option"
                aria-selected={idx === activeIndex}
                className={cn(
                  "flex w-full items-center gap-3 rounded px-2 text-left transition-colors",
                  isMobile ? "py-2.5" : "py-1.5",
                  idx === activeIndex
                    ? "bg-secondary text-foreground"
                    : "hover:bg-accent",
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onPointerDown={tap.onPointerDown}
                onPointerUp={tap.onPointerUp}
                onPointerCancel={tap.onPointerCancel}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border bg-card text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </EditorMenuSurface>
  );
}

// ── Renderer factory (used by SlashExtension `suggestion.render`) ─────────────
//
// @tiptap/suggestion calls `render()` once to get an object with lifecycle hooks.
// The returned object must match SuggestionRenderer<SlashCommandItem>.

export interface SlashMenuReactState {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  clientRect: (() => DOMRect | null) | null | undefined;
  isVisible: boolean;
}

/**
 * Creates the `render` function required by @tiptap/suggestion.
 * @param setState - React setState from the parent component
 * @param keyDownHandlerRef - A ref that the SlashCommandMenu will populate with its keyboard handler
 */
export function createSlashMenuRenderer(
  setState: (s: SlashMenuReactState | ((prev: SlashMenuReactState) => SlashMenuReactState)) => void,
  keyDownHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>
) {
  return (): {
    onStart: (props: SuggestionProps<SlashCommandItem>) => void;
    onUpdate: (props: SuggestionProps<SlashCommandItem>) => void;
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
    onExit: () => void;
  } => ({
    onStart(props) {
      setState({
        items: props.items,
        command: props.command,
        clientRect: props.clientRect ?? null,
        isVisible: true,
      });
    },

    onUpdate(props) {
      setState((prev) => ({
        ...prev,
        items: props.items,
        command: props.command,
        clientRect: props.clientRect ?? null,
      }));
    },

    onKeyDown({ event }) {
      return keyDownHandlerRef.current ? keyDownHandlerRef.current(event) : false;
    },

    onExit() {
      setState((prev) => ({ ...prev, isVisible: false, items: [] }));
    },
  });
}
