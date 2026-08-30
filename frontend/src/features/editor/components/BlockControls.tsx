"use client";

/**
 * BlockControls.tsx
 *
 * Botones flotantes "+" y "⠿" (grip) que aparecen al pasar por un bloque, y
 * los menús que abren. Los menús se renderizan con `EditorMenuSurface`
 * (Radix Popover en escritorio, Sheet en móvil) — ver ese archivo para el
 * porqué de los bugs históricos de scroll / foco del buscador.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Plus, GripVertical, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useBreakpoint";
import type { SlashCommandItem } from "../extensions/SlashExtension";
import { createTapSelectHandlers } from "../lib/tapSelect";
import { EditorMenuSurface } from "./EditorMenuSurface";

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
    direction === "up" ? rangeFrom + 1 : rangeFrom + swap.node.nodeSize + 1;

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
    editor.chain().focus().insertContentAt(range.to, { type: "paragraph" }).run();
    setCursorNear(editor, range.to + 1);
  } else {
    setCursorNear(editor, range.to + 1);
  }
}

// ── Grouping helper (shared by both menus) ────────────────────────────────────

interface OptionGroup {
  label: string;
  items: SlashCommandItem[];
}

function groupOptions(options: SlashCommandItem[], query: string): OptionGroup[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.keywords.some((k) => k.includes(q)),
      )
    : options;

  const groups: OptionGroup[] = [];
  const byGroup = (g: SlashCommandItem["group"]) => filtered.filter((o) => o.group === g);
  const basic = byGroup("basic");
  const lists = byGroup("lists");
  const advanced = byGroup("advanced");
  const media = byGroup("media");
  if (basic.length) groups.push({ label: "Básico", items: basic });
  if (lists.length) groups.push({ label: "Listas", items: lists });
  if (advanced.length) groups.push({ label: "Avanzado", items: advanced });
  if (media.length) groups.push({ label: "Media", items: media });
  return groups;
}

type AnchorRect = { top: number; left: number } | null;

// ── "+" menu (block type picker) ─────────────────────────────────────────────

interface BlockMenuProps {
  options: SlashCommandItem[];
  onSelect: (option: SlashCommandItem) => void;
  onClose: () => void;
  anchorRect: AnchorRect;
}

function BlockMenuPopup({ options, onSelect, onClose, anchorRect }: BlockMenuProps) {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const isMobile = useIsMobile();
  const pressRef = useRef<{ index: number; x: number; y: number; time: number } | null>(null);

  const groups = useMemo(() => groupOptions(options, search), [options, search]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setActiveIndex(0), [flat.length]);

  useEffect(() => {
    const el = document.querySelector(
      `[data-bm-idx="${activeIndex}"]`,
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = flat[activeIndex];
      if (sel) onSelect(sel);
    }
    // Escape lo maneja Radix (cierra el Popover, no el Dialog).
  };

  let globalIndex = 0;

  return (
    <EditorMenuSurface
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      anchorRect={anchorRect}
      autoFocus={!isMobile}
      ariaLabel="Insertar bloque"
      desktopMaxHeightClass="max-h-80"
      header={
        <input
          autoFocus={!isMobile}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Buscar bloques..."
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      }
    >
      {groups.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((option) => {
              const idx = globalIndex++;
              const Icon = option.icon;
              const tap = createTapSelectHandlers(idx, () => onSelect(flat[idx]), pressRef);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  data-bm-idx={idx}
                  className={cn(
                    "flex w-full items-center gap-3 rounded px-2 text-left transition-colors",
                    isMobile ? "py-2.5" : "py-1.5",
                    idx === activeIndex
                      ? "bg-secondary text-foreground"
                      : "hover:bg-accent",
                  )}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    tap.onPointerDown(e);
                  }}
                  onPointerUp={tap.onPointerUp}
                  onPointerCancel={tap.onPointerCancel}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-border bg-card text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {option.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </EditorMenuSurface>
  );
}

// ── Block actions menu (move / delete) ───────────────────────────────────────

interface BlockActionsMenuProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onClose: () => void;
  anchorRect: AnchorRect;
}

function BlockActionsMenuPopup({
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
  anchorRect,
}: BlockActionsMenuProps) {
  const item =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors sm:py-2";
  return (
    <EditorMenuSurface
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      anchorRect={anchorRect}
      ariaLabel="Acciones del bloque"
      className="w-52"
      desktopMaxHeightClass="max-h-none"
    >
      <button
        type="button"
        role="option"
        aria-selected={false}
        className={cn(item, "text-foreground hover:bg-accent")}
        onClick={() => {
          onMoveUp();
          onClose();
        }}
      >
        <ArrowUp className="h-4 w-4" /> Mover arriba
      </button>
      <button
        type="button"
        role="option"
        aria-selected={false}
        className={cn(item, "text-foreground hover:bg-accent")}
        onClick={() => {
          onMoveDown();
          onClose();
        }}
      >
        <ArrowDown className="h-4 w-4" /> Mover abajo
      </button>
      <div className="mx-2 my-1 h-px bg-border" />
      <button
        type="button"
        role="option"
        aria-selected={false}
        className={cn(
          item,
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
        )}
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="h-4 w-4" /> Eliminar bloque
      </button>
    </EditorMenuSurface>
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
  const rafRef = useRef<number | null>(null);
  const isMobile = useIsMobile();

  const [blockMenu, setBlockMenu] = useState<{ open: boolean; anchorRect: AnchorRect }>({
    open: false,
    anchorRect: null,
  });
  const [actionsMenu, setActionsMenu] = useState<{ open: boolean; anchorRect: AnchorRect }>({
    open: false,
    anchorRect: null,
  });

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
      // N6: throttle a un frame — antes hacía setState en cada mousemove (~60Hz).
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
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
        setHoveredBlockIndex((prev) => (prev === index ? prev : index));

        const range = getBlockRange(editor, index);
        if (range) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const coordTop = editor.view.coordsAtPos(range.from).top;
          const nextTop = coordTop - wrapperRect.top + wrapper.scrollTop;
          setControlsTop((prev) => (Math.abs(prev - nextTop) < 0.5 ? prev : nextTop));
        }
      });
    },
    [editor, disabled, wrapperRef],
  );

  useEffect(() => {
    if (isMobile) return;
    const editorEl = editor.view.dom;
    editorEl.addEventListener("mousemove", handleMouseMove as EventListener);
    editorEl.addEventListener("mouseleave", scheduleHide);
    return () => {
      editorEl.removeEventListener("mousemove", handleMouseMove as EventListener);
      editorEl.removeEventListener("mouseleave", scheduleHide);
    };
  }, [editor, handleMouseMove, scheduleHide, isMobile]);

  useEffect(
    () => () => {
      clearHideTimer();
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    [clearHideTimer],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const openBlockMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hoveredBlockIndex !== null) {
        prepareInsertAfter(editor, hoveredBlockIndex);
      }
      setActionsMenu((s) => ({ ...s, open: false }));
      setBlockMenu({ open: true, anchorRect: { top: e.clientY, left: e.clientX + 8 } });
    },
    [editor, hoveredBlockIndex],
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
      setActionsMenu({ open: true, anchorRect: { top: e.clientY, left: e.clientX + 8 } });
    },
    [editor, hoveredBlockIndex],
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

      // `option.apply` ya abre el file picker para las opciones de media
      // (lib/blockOptions.tsx). Antes se volvia a llamar aqui, disparando
      // `input.click()` dos veces en el mismo tick.
      setBlockMenu({ open: false, anchorRect: null });
    },
    [editor, triggerImageFileInput],
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

  /**
   * Botón "+" persistente (siempre visible, en móvil y escritorio): abre el
   * menú de bloques anclado a la posición actual del cursor.
   */
  const openBlockMenuFromButton = useCallback(() => {
    editor.chain().focus().run();
    setActionsMenu((s) => ({ ...s, open: false }));
    let anchorRect: AnchorRect = null;
    try {
      const coords = editor.view.coordsAtPos(editor.state.selection.head);
      anchorRect = { top: coords.bottom, left: coords.left };
    } catch {
      anchorRect = null;
    }
    setBlockMenu({ open: true, anchorRect });
  }, [editor]);

  if (disabled) return null;

  const showControls =
    !isMobile && (hoveredBlockIndex !== null || blockMenu.open || actionsMenu.open);

  return (
    <>
      {/* Botón "+" persistente (siempre visible), en color de marca para que
          destaque sobre el editor. */}
      <button
        type="button"
        aria-label="Insertar bloque"
        title="Insertar bloque"
        className="pointer-events-auto absolute bottom-2 right-1 z-40 flex h-10 w-10 items-center justify-center rounded border-2 border-border bg-primary text-primary-foreground shadow-hard transition hover:bg-primary/90 active:scale-95 dark:shadow-hard-float"
        onPointerDown={(e) => e.preventDefault()}
        onClick={openBlockMenuFromButton}
      >
        <Plus className="h-5 w-5" />
      </button>

      {showControls && (
        <div
          className="pointer-events-auto absolute flex items-center gap-0.5"
          style={{ top: controlsTop, left: 4, transform: "translateY(-1px)", zIndex: 40 }}
          onMouseEnter={() => {
            clearHideTimer();
            setIsHoveringControls(true);
          }}
          onMouseLeave={() => {
            setIsHoveringControls(false);
            if (!blockMenu.open && !actionsMenu.open) scheduleHide();
          }}
        >
          <button
            type="button"
            aria-label="Agregar bloque"
            title="Agregar bloque"
            className="flex h-6 w-6 items-center justify-center rounded bg-transparent text-muted-foreground transition hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openBlockMenu}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Opciones de bloque"
            title="Mover o eliminar bloque"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded bg-transparent text-muted-foreground transition hover:bg-accent hover:text-foreground active:cursor-grabbing"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openActionsMenu}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {blockMenu.open ? (
        <BlockMenuPopup
          options={blockOptions}
          onSelect={handleSelectBlock}
          onClose={() => setBlockMenu({ open: false, anchorRect: null })}
          anchorRect={blockMenu.anchorRect}
        />
      ) : null}

      {actionsMenu.open ? (
        <BlockActionsMenuPopup
          onMoveUp={() => moveBlock(editor, hoveredBlockIndex ?? 0, "up")}
          onMoveDown={() => moveBlock(editor, hoveredBlockIndex ?? 0, "down")}
          onDelete={deleteBlock}
          onClose={() => setActionsMenu({ open: false, anchorRect: null })}
          anchorRect={actionsMenu.anchorRect}
        />
      ) : null}
    </>
  );
}
