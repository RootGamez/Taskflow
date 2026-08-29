"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";
import { createTapSelectHandlers } from "./tapSelect";
import { EditorMenuSurface } from "./EditorMenuSurface";

export interface MentionItem {
  id: string;
  label: string;
  avatarUrl: string | null;
}

export interface MentionReactState {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
  clientRect: (() => DOMRect | null) | null | undefined;
  isVisible: boolean;
}

interface MentionListProps {
  state: MentionReactState;
  keyDownHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>;
  container?: HTMLElement | null;
  onDismiss?: () => void;
}

function Initials({ label }: { label: string }) {
  const text = label
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
      {text}
    </span>
  );
}

export function MentionList({ state, keyDownHandlerRef, container, onDismiss }: MentionListProps) {
  const { items, command, clientRect, isVisible } = state;
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number } | null>(null);
  const pressRef = useRef<{ index: number; x: number; y: number; time: number } | null>(null);

  useEffect(() => setActiveIndex(0), [items]);

  useEffect(() => {
    if (!clientRect) return;
    const rect = clientRect();
    if (rect) setAnchorRect({ top: rect.bottom, left: rect.left });
  }, [clientRect, items]);

  const select = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command({ id: item.id, label: item.label });
    },
    [items, command],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.key === "ArrowDown") {
        setActiveIndex((i) => (i + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setActiveIndex((i) => (i - 1 + items.length) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        select(activeIndex);
        return true;
      }
      return false;
    },
    [items.length, activeIndex, select],
  );

  useEffect(() => {
    keyDownHandlerRef.current = handleKeyDown;
    return () => {
      keyDownHandlerRef.current = null;
    };
  }, [handleKeyDown, keyDownHandlerRef]);

  if (!isVisible || items.length === 0) return null;

  return (
    <EditorMenuSurface
      open
      onOpenChange={(next) => {
        if (!next) onDismiss?.();
      }}
      anchorRect={anchorRect}
      container={container}
      autoFocus={false}
      ariaLabel="Mencionar a alguien"
      className="w-64"
      desktopMaxHeightClass="max-h-64"
    >
      {items.map((item, idx) => {
        const tap = createTapSelectHandlers(idx, select, pressRef);
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={idx === activeIndex}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
              idx === activeIndex
                ? "bg-zinc-100 dark:bg-zinc-800"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
            )}
            onMouseEnter={() => setActiveIndex(idx)}
            onPointerDown={tap.onPointerDown}
            onPointerUp={tap.onPointerUp}
            onPointerCancel={tap.onPointerCancel}
          >
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Initials label={item.label} />
            )}
            <span className="truncate text-zinc-800 dark:text-zinc-100">{item.label}</span>
          </button>
        );
      })}
    </EditorMenuSurface>
  );
}

/** Factory del `render` que exige `@tiptap/suggestion`, calcado del slash menu. */
export function createMentionRenderer(
  setState: (s: MentionReactState | ((prev: MentionReactState) => MentionReactState)) => void,
  keyDownHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>,
) {
  return () => ({
    onStart(props: SuggestionProps) {
      setState({
        items: props.items as MentionItem[],
        command: props.command as (item: { id: string; label: string }) => void,
        clientRect: props.clientRect ?? null,
        isVisible: true,
      });
    },
    onUpdate(props: SuggestionProps) {
      setState((prev) => ({
        ...prev,
        items: props.items as MentionItem[],
        command: props.command as (item: { id: string; label: string }) => void,
        clientRect: props.clientRect ?? null,
      }));
    },
    onKeyDown({ event }: SuggestionKeyDownProps) {
      return keyDownHandlerRef.current ? keyDownHandlerRef.current(event) : false;
    },
    onExit() {
      setState((prev) => ({ ...prev, isVisible: false, items: [] }));
    },
  });
}
