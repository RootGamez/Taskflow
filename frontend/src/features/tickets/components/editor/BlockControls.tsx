"use client";

/**
 * BlockControls.tsx
 *
 * Floating "+" and "⠿" (grip) buttons that appear on block hover.
 *
 * Key fix vs the old implementation:
 *   - Uses `position: absolute` relative to the `.tf-editor-wrapper` (position: relative).
 *   - `top` is (coordsAtPos().top - wrapper.getBoundingClientRect().top + scrollTop)
 *     so it stays correct during scroll, dialog animations and viewport resize.
 *   - Handles atom nodes (image, hr) correctly when inserting after them.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { Plus, GripVertical } from "lucide-react";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { cn } from "@/lib/utils";
import type { SlashCommandItem } from "../extensions/SlashExtension";

// ── ProseMirror helpers ───────────────────────────────────────────────────────

export function getBlockIndexAtPos(editor: Editor, pos: number): number {
  const { doc } = editor.state;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const from = offset + 1;
    const to = from + node.nodeSize - 1;
    if (pos >= from && pos <= to) return i;
    offset += node.nodeSize;
  }
  return -1;
}

export function getBlockRange(editor: Editor, index: number) {
  const { doc } = editor.state;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    const from = offset + 1;
    const to = offset + node.nodeSize;
    if (i === index) return { from, to, node };
    offset += node.nodeSize;
  }
  return null;
}

function moveBlock(editor: Editor, hoveredIndex: number, direction: "up" | "down") {
  const { doc } = editor.state;
  const swapIndex = direction === "up" ? hoveredIndex - 1 : hoveredIndex + 1;
  if (swapIndex < 0 || swapIndex >= doc.childCount) return;

  const current = getBlockRange(editor, hoveredIndex);
  const swap = getBlockRange(editor, swapIndex);
  if (!current || !swap) return;

  const rangeFrom = Math.min(current.from, swap.from) - 1;
  const rangeTo = Math.max(current.to, swap.to);

  const { tr } = editor.state;
  const nodes =
    direction === "up"
      ? Fragment.fromArray([current.node, swap.node])
      : Fragment.fromArray([swap.node, current.node]);

  tr.replaceWith(rangeFrom, rangeTo, nodes);

  const newPos =
    direction === "up"
      ? rangeFrom + 1
      : rangeFrom + swap.node.nodeSize + 1;

  const resolved = tr.doc.resolve(Math.min(newPos, tr.doc.content.size - 1));
  tr.setSelection(TextSelection.near(resolved));
  editor.view.dispatch(tr);
  editor.commands.focus();
}

function setCursorNear(editor: Editor, pos: number) {
  const { doc, tr } = editor.state;
  const safePos = Math.max(1, Math.min(pos, doc.content.size));
  const resolved = doc.resolve(safePos);
  editor.view.dispatch(tr.setSelection(TextSelection.near(resolved)));
  editor.commands.focus();
}

/** Safely set the cursor to the block so the BlockMenu can insert after it */
function prepareInsertAfter(editor: Editor, index: number) {
  const range = getBlockRange(editor, index);
  if (!range) return;
  const { node } = range;

  if (node.isAtom || !node.isTextblock) {
    // For atoms, insert a new paragraph right after and move the cursor there
    editor
      .chain()
      .focus()
      .insertContentAt(range.to, { type: "paragraph" })
      .run();
    setCursorNear(editor, range.to + 1);
  } else {
    setCursorNear(editor, range.to + 1);
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface BlockMenuProps {
  options: SlashCommandItem[];
  onSelect: (option: SlashCommandItem) => void;
  onClose: () => void;
  x: number;
  y: number;
}

function BlockMenuPopup({ options, onSelect, onClose, x, y }: BlockMenuProps) {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            o.keywords.some((k) => k.includes(q))
        )
      : options;

    const basic = filtered.filter((o) => o.group === "basic");
    const lists = filtered.filter((o) => o.group === "lists");
    const advanced = filtered.filter((o) => o.group === "advanced");
    const media = filtered.filter((o) => o.group === "media");
    const groups: { label: string; items: SlashCommandItem[] }[] = [];
    if (basic.length) groups.push({ label: "Básico", items: basic });
    if (lists.length) groups.push({ label: "Listas", items: lists });
    if (advanced.length) groups.push({ label: "Avanzado", items: advanced });
    if (media.length) groups.push({ label: "Media", items: media });
    return groups;
  }, [options, search]);

  const flatFiltered = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => setActiveIndex(0), [flatFiltered.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, flatFiltered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const sel = flatFiltered[activeIndex]; if (sel) onSelect(sel); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, flatFiltered, onClose, onSelect]);

  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", handleClick);
    return () => window.removeEventListener("pointerdown", handleClick);
  }, [onClose]);

  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-bm-idx="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Flip up if near bottom
  const menuHeight = 320;
  const top = y + menuHeight > window.innerHeight - 16 ? y - menuHeight : y + 4;

  let globalIndex = 0;

  return (
    <div
      style={{ position: "fixed", top, left: x, zIndex: 9999, pointerEvents: "auto" }}
      ref={containerRef}
    >
      <div className="w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bloques..."
            className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain p-1">
          {grouped.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-400">Sin resultados</p>
          ) : (
            grouped.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {group.label}
                </p>
                {group.items.map((option) => {
                  const idx = globalIndex++;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      data-bm-idx={idx}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors",
                        idx === activeIndex
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      )}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(option);
                      }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {option.label}
                        </span>
                        <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface BlockActionsMenuProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onClose: () => void;
  x: number;
  y: number;
}

function BlockActionsMenuPopup({
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
  x,
  y,
}: BlockActionsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("pointerdown", handleClick);
    return () => window.removeEventListener("pointerdown", handleClick);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", top: y, left: x, zIndex: 9999, pointerEvents: "auto" }}
      ref={ref}
    >
      <div className="w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 flex flex-col">
        <button
          type="button"
          className="flex w-full items-start px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onMoveUp(); onClose(); }}
        >
          ↑ Mover arriba
        </button>
        <button
          type="button"
          className="flex w-full items-start px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onMoveDown(); onClose(); }}
        >
          ↓ Mover abajo
        </button>
        <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
        <button
          type="button"
          className="flex w-full items-start px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition-colors"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); onClose(); }}
        >
          Eliminar bloque
        </button>
      </div>
    </div>
  );
}

// ── Main BlockControls component ──────────────────────────────────────────────

interface BlockControlsProps {
  editor: Editor;
  /** Reference to the `.tf-editor-wrapper` div (must be position: relative) */
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  blockOptions: SlashCommandItem[];
  disabled?: boolean;
  triggerImageFileInput?: (() => void) | null;
}

export function BlockControls({
  editor,
  wrapperRef,
  blockOptions,
  disabled = false,
  triggerImageFileInput,
}: BlockControlsProps) {
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const [controlsTop, setControlsTop] = useState(0);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const [blockMenu, setBlockMenu] = useState({ open: false, x: 0, y: 0 });
  const [actionsMenu, setActionsMenu] = useState({ open: false, x: 0, y: 0 });

  /** Portal target: prefer dialog content, fallback to body */
  const portalContainer = useMemo(
    () =>
      (editor.view.dom.closest("[data-slot='dialog-content']") as HTMLElement | null) ??
      document.body,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor]
  );

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      if (!blockMenu.open && !actionsMenu.open && !isHoveringControls) {
        setHoveredBlockIndex(null);
      }
    }, 140);
  }, [blockMenu.open, actionsMenu.open, isHoveringControls, clearHideTimer]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (disabled || !editor.view) return;
      const wrapper = wrapperRef.current;
      if (!wrapper) return;

      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      let index = -1;

      if (pos) {
        index = getBlockIndexAtPos(editor, pos.pos);
      } else {
        const childCount = editor.state.doc.childCount;
        if (childCount > 0) index = childCount - 1;
      }

      if (index === -1) {
        setHoveredBlockIndex(null);
        return;
      }
      setHoveredBlockIndex(index);

      // ── Key fix: absolute positioning relative to wrapper ──────────────
      const range = getBlockRange(editor, index);
      if (range) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const coordTop = editor.view.coordsAtPos(range.from).top;
        // scrollTop included for when the wrapper itself scrolls
        setControlsTop(coordTop - wrapperRect.top + wrapper.scrollTop);
      }
    },
    [editor, disabled, wrapperRef]
  );

  useEffect(() => {
    const editorEl = editor.view.dom;
    editorEl.addEventListener("mousemove", handleMouseMove as EventListener);
    editorEl.addEventListener("mouseleave", scheduleHide);
    return () => {
      editorEl.removeEventListener("mousemove", handleMouseMove as EventListener);
      editorEl.removeEventListener("mouseleave", scheduleHide);
    };
  }, [editor, handleMouseMove, scheduleHide]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const openBlockMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hoveredBlockIndex !== null) {
        prepareInsertAfter(editor, hoveredBlockIndex);
      }
      setActionsMenu((s) => ({ ...s, open: false }));
      setBlockMenu({ open: true, x: e.clientX + 8, y: e.clientY });
    },
    [editor, hoveredBlockIndex]
  );

  const openActionsMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hoveredBlockIndex !== null) {
        const range = getBlockRange(editor, hoveredBlockIndex);
        if (range) {
          if (range.node.isAtom || !range.node.isTextblock) {
            editor.chain().setNodeSelection(range.from - 1).focus().run();
          } else {
            setCursorNear(editor, range.from + 1);
          }
        }
      }
      setBlockMenu((s) => ({ ...s, open: false }));
      setActionsMenu({ open: true, x: e.clientX + 8, y: e.clientY });
    },
    [editor, hoveredBlockIndex]
  );

  const handleSelectBlock = useCallback(
    (option: SlashCommandItem) => {
      if (!editor) return;
      const { selection, doc } = editor.state;
      const curNode =
        doc.nodeAt(Math.max(0, selection.from - 1)) || doc.nodeAt(selection.from);
      const isEmpty = curNode?.isTextblock && curNode.textContent === "";

      if (isEmpty) {
        option.apply(editor);
      } else {
        editor.chain().focus().insertContent({ type: "paragraph" }).run();
        option.apply(editor);
      }

      // Trigger image file input if the option needs it
      if (option.id === "image") {
        triggerImageFileInput?.();
      }

      setBlockMenu({ open: false, x: 0, y: 0 });
    },
    [editor, triggerImageFileInput]
  );

  const deleteBlock = useCallback(() => {
    if (hoveredBlockIndex === null) return;
    const range = getBlockRange(editor, hoveredBlockIndex);
    if (!range) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: range.from - 1, to: range.to })
      .run();
  }, [editor, hoveredBlockIndex]);

  if (disabled) return null;

  const showControls =
    hoveredBlockIndex !== null || blockMenu.open || actionsMenu.open;

  return (
    <>
      {/* Absolute-positioned controls (relative to wrapper) */}
      {showControls && (
        <div
          className="pointer-events-auto absolute flex items-center gap-0.5"
          style={{
            top: controlsTop,
            left: 4,
            transform: "translateY(-1px)",
            zIndex: 40,
          }}
          onMouseEnter={() => { clearHideTimer(); setIsHoveringControls(true); }}
          onMouseLeave={() => {
            setIsHoveringControls(false);
            if (!blockMenu.open && !actionsMenu.open) scheduleHide();
          }}
        >
          <button
            type="button"
            aria-label="Agregar bloque"
            title="Agregar bloque"
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 bg-transparent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openBlockMenu}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Opciones de bloque"
            title="Mover o eliminar bloque"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200 bg-transparent"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openActionsMenu}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Block type picker portal */}
      {blockMenu.open &&
        createPortal(
          <BlockMenuPopup
            options={blockOptions}
            onSelect={handleSelectBlock}
            onClose={() => setBlockMenu({ open: false, x: 0, y: 0 })}
            x={blockMenu.x}
            y={blockMenu.y}
          />,
          portalContainer
        )}

      {/* Block actions portal */}
      {actionsMenu.open &&
        createPortal(
          <BlockActionsMenuPopup
            onMoveUp={() => moveBlock(editor, hoveredBlockIndex ?? 0, "up")}
            onMoveDown={() => moveBlock(editor, hoveredBlockIndex ?? 0, "down")}
            onDelete={deleteBlock}
            onClose={() => setActionsMenu({ open: false, x: 0, y: 0 })}
            x={actionsMenu.x}
            y={actionsMenu.y}
          />,
          portalContainer
        )}
    </>
  );
}
