"use client";

/**
 * EmojiList.tsx
 *
 * Desplegable de emojis que sale al escribir dos puntos. Sigue el mismo
 * patron que `MentionList` y `SlashCommandMenu`: el ciclo de vida lo
 * conduce `@tiptap/suggestion` y el render vive en React, portado a
 * `EditorMenuSurface` para que herede el flip/colision de Radix y el
 * comportamiento de hoja en movil.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { createTapSelectHandlers } from "../lib/tapSelect";
import { EditorMenuSurface } from "./EditorMenuSurface";

/** Lo que expone `@tiptap/extension-emoji` por cada resultado. */
export interface EmojiSuggestionItem {
  name: string;
  shortcodes: string[];
  emoji?: string;
  fallbackImage?: string;
}

export interface EmojiReactState {
  items: EmojiSuggestionItem[];
  command: (item: EmojiSuggestionItem) => void;
  clientRect: (() => DOMRect | null) | null | undefined;
  isVisible: boolean;
}

interface EmojiListProps {
  state: EmojiReactState;
  keyDownHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>;
  container?: HTMLElement | null;
  onDismiss?: () => void;
}

export function EmojiList({ state, keyDownHandlerRef, container, onDismiss }: EmojiListProps) {
  const { items, command, clientRect, isVisible } = state;
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number } | null>(null);
  const isMobile = useIsMobile();
  const pressRef = useRef<{ index: number; x: number; y: number; time: number } | null>(null);

  useEffect(() => setActiveIndex(0), [items]);

  useEffect(() => {
    const rect = clientRect?.();
    if (rect) setAnchorRect({ top: rect.bottom, left: rect.left });
  }, [clientRect, items]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.key === "ArrowDown") {
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter") {
        const selected = items[activeIndex];
        if (selected) command(selected);
        return true;
      }
      return false;
    },
    [activeIndex, items, command],
  );

  useEffect(() => {
    keyDownHandlerRef.current = handleKeyDown;
    return () => {
      keyDownHandlerRef.current = null;
    };
  }, [handleKeyDown, keyDownHandlerRef]);

  useEffect(() => {
    const el = document.querySelector(`[data-emoji-index="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

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
      ariaLabel="Insertar emoji"
      desktopMaxHeightClass="max-h-64"
    >
      {items.map((item, index) => {
        const tap = createTapSelectHandlers(index, () => command(items[index]), pressRef);
        return (
          <button
            key={item.name}
            data-emoji-index={index}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={cn(
              "flex w-full items-center gap-3 rounded px-2 text-left transition-colors",
              isMobile ? "py-2.5" : "py-1.5",
              index === activeIndex ? "bg-secondary text-foreground" : "hover:bg-accent",
            )}
            onMouseEnter={() => setActiveIndex(index)}
            onPointerDown={tap.onPointerDown}
            onPointerUp={tap.onPointerUp}
            onPointerCancel={tap.onPointerCancel}
          >
            <span className="w-6 shrink-0 text-center text-lg leading-none">
              {item.emoji ?? (
                <img src={item.fallbackImage} alt="" className="inline-block h-5 w-5" />
              )}
            </span>
            <span className="truncate text-sm text-foreground">:{item.name}:</span>
          </button>
        );
      })}
    </EditorMenuSurface>
  );
}

/** Factory del `render` que exige `@tiptap/suggestion`, calcada del slash menu. */
export function createEmojiRenderer(
  setState: (s: EmojiReactState | ((prev: EmojiReactState) => EmojiReactState)) => void,
  keyDownHandlerRef: React.MutableRefObject<((e: KeyboardEvent) => boolean) | null>,
) {
  return (): {
    onStart: (props: SuggestionProps<EmojiSuggestionItem>) => void;
    onUpdate: (props: SuggestionProps<EmojiSuggestionItem>) => void;
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
