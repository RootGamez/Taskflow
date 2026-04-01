"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SlashCommandItem } from "../extensions/SlashExtension";
import { cn } from "@/lib/utils";

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
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlashCommandMenu({
  items,
  command,
  clientRect,
  isVisible,
  keyDownHandlerRef,
}: SlashCommandMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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

  // Update position from DOMRect (provided by @tiptap/suggestion)
  useEffect(() => {
    if (!clientRect) return;
    const rect = clientRect();
    if (!rect) return;

    const menuHeight = containerRef.current?.offsetHeight ?? 300;
    const menuWidth = containerRef.current?.offsetWidth ?? 288;
    const vp = { w: window.innerWidth, h: window.innerHeight };

    let top = rect.bottom + 6;
    let left = rect.left;

    if (top + menuHeight > vp.h - 16) top = rect.top - menuHeight - 6;
    if (left + menuWidth > vp.w - 8) left = vp.w - menuWidth - 8;
    left = Math.max(8, left);

    setPosition({ top, left });
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
    const el = containerRef.current?.querySelector(
      `[data-slash-index="${activeIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isVisible || flatItems.length === 0) return null;

  let globalIndex = 0;

  return createPortal(
    <div
      style={{ position: "fixed", top: position.top, left: position.left, zIndex: 9999 }}
      ref={containerRef}
    >
      <div className="w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div
          className="max-h-72 overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => {
            const el = e.currentTarget;
            const max = el.scrollHeight - el.clientHeight;
            if ((e.deltaY > 0 && el.scrollTop < max) || (e.deltaY < 0 && el.scrollTop > 0)) {
              e.preventDefault();
              el.scrollTop += e.deltaY;
            }
          }}
        >
          {grouped.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                {group.label}
              </p>
              {group.items.map((item) => {
                const idx = globalIndex++;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    data-slash-index={idx}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                      idx === activeIndex
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    )}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      command(item);
                    }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {item.label}
                      </span>
                      <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
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
