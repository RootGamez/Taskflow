"use client";

/**
 * BlockControls.tsx
 *
 * Botones flotantes "+" y "⠿" (asa) junto al bloque bajo el cursor, y los
 * menús que abren. Los menús se renderizan con `EditorMenuSurface` (Radix
 * Popover en escritorio, Sheet en móvil) — ver ese archivo para el porqué
 * de los bugs históricos de scroll / foco del buscador.
 *
 * El posicionamiento y el arrastre los hace `DragHandle` de Tiptap. Antes
 * este archivo rastreaba el hover a mano (mousemove + `posAtCoords` + un
 * rAF de throttle + temporizadores de ocultado, ~70 líneas) y aun así solo
 * permitía mover bloques de uno en uno con "Mover arriba"/"Mover abajo",
 * sin arrastre real.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { Plus, GripVertical, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
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
  blockOptions: SlashCommandItem[];
  disabled?: boolean;
  triggerImageFileInput?: (() => void) | null;
}

export function BlockControls({
  editor,
  blockOptions,
  disabled = false,
  triggerImageFileInput,
}: BlockControlsProps) {
  // `DragHandle` nos dice que bloque tiene el cursor encima; de ahi sale el
  // indice que usan mover/borrar/insertar.
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset();

  const [blockMenu, setBlockMenu] = useState<{ open: boolean; anchorRect: AnchorRect }>({
    open: false,
    anchorRect: null,
  });
  const [actionsMenu, setActionsMenu] = useState<{ open: boolean; anchorRect: AnchorRect }>({
    open: false,
    anchorRect: null,
  });

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

  const insertButtonElement = (
    <button
      type="button"
      aria-label="Insertar bloque"
      title="Insertar bloque"
      className={cn(
        "pointer-events-auto flex items-center justify-center rounded border-2 border-border bg-primary text-primary-foreground shadow-hard transition hover:bg-primary/90 active:scale-95 dark:shadow-hard-float",
        isMobile
          ? // Anclado al viewport y no al final del editor: en un ticket
            // largo, el boton quedaba fuera de pantalla justo cuando hacia
            // falta -- para insertar algo en medio habia que bajar hasta el
            // final del documento.
            //
            // `z-[60]` no es arbitrario: el editor suele vivir dentro de un
            // dialogo (TicketDetail), y su overlay y su contenido son `z-50`,
            // asi que con el `z-40` de escritorio el boton quedaba enterrado
            // bajo el modal. Por arriba lo limita el menu que abre este mismo
            // boton (EditorMenuSurface, `zIndex: 9999`), que debe taparlo.
            "fixed right-4 z-[60] h-12 w-12 transition-[bottom] duration-150"
          : "absolute bottom-2 right-1 z-40 h-10 w-10",
      )}
      style={
        isMobile
          ? {
              // Con el teclado abierto hay que subirlo por encima de el: en
              // iOS `fixed` se ancla al viewport de layout, que el teclado no
              // encoge, asi que el boton quedaba tapado justo mientras se
              // escribe. Cerrado el teclado basta con librar la barra de
              // gestos (`safe-area-inset-bottom`), que ahi si aplica.
              bottom: keyboardInset
                ? `calc(1rem + ${keyboardInset}px)`
                : "calc(1rem + env(safe-area-inset-bottom, 0px))",
            }
          : undefined
      }
      onPointerDown={(e) => e.preventDefault()}
      onClick={openBlockMenuFromButton}
    >
      <Plus className={isMobile ? "h-6 w-6" : "h-5 w-5"} />
    </button>
  );

  // En movil va por portal a `document.body`: el editor puede vivir dentro
  // de un dialogo de Radix, y un ancestro con `transform` convierte
  // `position: fixed` en relativo a ese ancestro, no al viewport.
  const insertButton =
    isMobile && typeof document !== "undefined"
      ? createPortal(insertButtonElement, document.body)
      : insertButtonElement;

  return (
    <>
      {insertButton}

      {/*
        `DragHandle` reemplaza el rastreo de hover que este componente hacia
        a mano (mousemove + posAtCoords + rAF) y, sobre todo, permite
        ARRASTRAR bloques de verdad: antes solo se podian mover de uno en
        uno con "Mover arriba"/"Mover abajo".

        En movil no se monta: el asa depende del puntero y ahi el hueco lo
        cubre el FAB "+" de arriba.
      */}
      {!isMobile && (
        <DragHandle
          editor={editor}
          onNodeChange={({ pos }) => {
            setHoveredBlockIndex(pos >= 0 ? getBlockIndexAtPos(editor, pos) : null);
          }}
          className="pointer-events-auto flex items-center gap-0.5"
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
          {/* Este boton es el asa: arrastrarlo mueve el bloque, y un clic
              simple abre el menu de acciones (que conserva mover y borrar
              para quien navegue por teclado, donde arrastrar no sirve). */}
          <button
            type="button"
            aria-label="Mover o eliminar bloque"
            title="Arrastra para mover, o haz clic para más acciones"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded bg-transparent text-muted-foreground transition hover:bg-accent hover:text-foreground active:cursor-grabbing"
            onClick={openActionsMenu}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </DragHandle>
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
