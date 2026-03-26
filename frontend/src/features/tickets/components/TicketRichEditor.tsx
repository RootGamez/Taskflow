"use client";
 
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckSquare2,
  Code2,
  GripVertical,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Pilcrow,
  Plus,
  Quote,
  Minus,
} from "lucide-react";
import {
  EditorContent,
  type Editor,
  useEditor,
  Extension,
} from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Dropcursor from "@tiptap/extension-dropcursor";
import StarterKit from "@tiptap/starter-kit";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { cn } from "@/lib/utils";
 
// ─── Tipos ────────────────────────────────────────────────────────────────────
 
interface TicketRichEditorProps {
  /** JSON de ProseMirror (objeto) o string vacío */
  value: Record<string, unknown> | null;
  placeholder?: string;
  disabled?: boolean;
  isLocked?: boolean;
  lockHint?: string;
  /** Emite JSON de ProseMirror, no HTML */
  onChange: (value: Record<string, unknown>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}
 
interface BlockOption {
  id: string;
  label: string;
  description: string;
  group: "basic" | "lists" | "advanced";
  keywords: string[];
  icon: React.ElementType;
  apply: (editor: Editor) => void;
}
 
interface BlockMenuState {
  open: boolean;
  // posición en coordenadas de la ventana, para el portal
  x: number;
  y: number;
}
 
// ─── Helpers de bloques ───────────────────────────────────────────────────────
 
function getBlockIndexAtPos(editor: Editor, pos: number): number {
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
 
function getBlockRange(editor: Editor, index: number) {
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
 
function moveBlock(editor: Editor, direction: "up" | "down") {
  const { selection, doc } = editor.state;
  const currentIndex = getBlockIndexAtPos(editor, selection.from);
  if (currentIndex === -1) return;
 
  const swapIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (swapIndex < 0 || swapIndex >= doc.childCount) return;
 
  const current = getBlockRange(editor, currentIndex);
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
 
// ─── Extensión: slash command (/comando) ──────────────────────────────────────
// Detecta cuando el usuario escribe "/" al inicio de un bloque vacío
// y notifica para abrir el menú de bloques.
 
interface SlashCommandOptions {
  onTrigger: (coords: { x: number; y: number }) => void;
  onClose: () => void;
}
 
const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: "slashCommand",
 
  addOptions() {
    return {
      onTrigger: () => {},
      onClose: () => {},
    };
  },
 
  addProseMirrorPlugins() {
    const { onTrigger, onClose } = this.options;
 
    return [
      new Plugin({
        key: new PluginKey("slashCommand"),
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "/") return false;
 
            const { selection, doc } = view.state;
            const { from } = selection;
 
            // Solo activar si el bloque actual está vacío
            const resolved = doc.resolve(from);
            const node = resolved.parent;
            if (!node.isTextblock || node.textContent !== "") return false;
 
            // Calcular posición del cursor en pantalla
            const coords = view.coordsAtPos(from);
            onTrigger({ x: coords.left, y: coords.bottom });
 
            return false; // No consumir el evento — el "/" igual se escribe y lo borramos
          },
          handleTextInput(_view, _from, _to, text) {
            if (text !== "/") {
              onClose();
            }
            return false;
          },
        },
      }),
    ];
  },
});
 
// ─── Portal para menús flotantes ─────────────────────────────────────────────
// Renderiza fuera del DOM del editor para evitar problemas de overflow/clip.
 
import { createPortal } from "react-dom";
 
interface FloatingPortalProps {
  children: React.ReactNode;
  x: number;
  y: number;
  container?: HTMLElement | null;
}
 
function FloatingPortal({ children, x, y, container }: FloatingPortalProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container || !rootRef.current) {
      return;
    }

    const dataKey = "tfEditorBasePaddingBottom";
    if (!container.dataset[dataKey]) {
      const basePadding = Number.parseFloat(getComputedStyle(container).paddingBottom) || 0;
      container.dataset[dataKey] = String(basePadding);
    }

    const basePadding = Number.parseFloat(container.dataset[dataKey] ?? "0") || 0;

    const syncContainerSpace = () => {
      if (!rootRef.current) return;
      const menuRect = rootRef.current.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const overflowBottom = Math.max(0, menuRect.bottom - containerRect.bottom + 16);
      container.style.paddingBottom = `${basePadding + overflowBottom}px`;
    };

    syncContainerSpace();

    const ro = new ResizeObserver(syncContainerSpace);
    ro.observe(rootRef.current);
    window.addEventListener("resize", syncContainerSpace);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncContainerSpace);
      const floatingCount = container.querySelectorAll("[data-ticket-editor-floating='true']").length;
      if (floatingCount <= 1) {
        container.style.paddingBottom = `${basePadding}px`;
      }
    };
  }, [container, x, y]);

  return createPortal(
    <div
      ref={rootRef}
      data-ticket-editor-floating="true"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 9999,
        pointerEvents: "auto",
      }}
    >
      {children}
    </div>,
    container ?? document.body
  );
}
 
// ─── Menú de bloques ─────────────────────────────────────────────────────────
 
interface BlockMenuProps {
  options: BlockOption[];
  onSelect: (option: BlockOption) => void;
  onClose: () => void;
  x: number;
  y: number;
  portalContainer?: HTMLElement | null;
}
 
function BlockMenu({ options, onSelect, onClose, x, y, portalContainer }: BlockMenuProps) {
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPointerOverList, setIsPointerOverList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);
 
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.keywords.some((k) => k.includes(q))
    );
  }, [options, search]);
 
  // Resetear índice activo al filtrar
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);
 
  const grouped = useMemo(() => {
    const groups: { label: string; items: BlockOption[] }[] = [];
    const basic = filtered.filter((o) => o.group === "basic");
    const lists = filtered.filter((o) => o.group === "lists");
    const advanced = filtered.filter((o) => o.group === "advanced");
    if (basic.length) groups.push({ label: "Básico", items: basic });
    if (lists.length) groups.push({ label: "Listas", items: lists });
    if (advanced.length) groups.push({ label: "Avanzado", items: advanced });
    return groups;
  }, [filtered]);
 
  const flatFiltered = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped]
  );
 
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatFiltered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = flatFiltered[activeIndex];
        if (selected) onSelect(selected);
        return;
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeIndex, flatFiltered, onClose, onSelect]);
 
  useEffect(() => {
    const handleClick = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("pointerdown", handleClick);
    return () => window.removeEventListener("pointerdown", handleClick);
  }, [onClose]);
 
  // Scroll automático al elemento activo
  useEffect(() => {
    const el = containerRef.current?.querySelector(
      `[data-index="${activeIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleListWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isPointerOverList) {
        return;
      }

      const listEl = event.currentTarget;
      const nextScrollTop = listEl.scrollTop + event.deltaY;
      const maxScrollTop = listEl.scrollHeight - listEl.clientHeight;
      const willScroll = nextScrollTop >= 0 && nextScrollTop <= maxScrollTop;

      if (willScroll) {
        event.preventDefault();
        event.stopPropagation();
        listEl.scrollTop = nextScrollTop;
      }
    },
    [isPointerOverList]
  );
 
  let globalIndex = 0;
 
  return (
    <FloatingPortal x={x} y={y + 4} container={portalContainer}>
      <div
        ref={containerRef}
        className="w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        {/* Buscador */}
        <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bloques..."
            className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>
 
        {/* Lista de opciones */}
        <div
          className="max-h-72 overflow-y-auto overscroll-contain p-1"
          onMouseEnter={() => setIsPointerOverList(true)}
          onMouseLeave={() => setIsPointerOverList(false)}
          onWheel={handleListWheel}
        >
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
                      data-index={idx}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition",
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
    </FloatingPortal>
  );
}
 
// ─── Menú de acciones de bloque (grip) ────────────────────────────────────────
 
interface BlockActionsMenuProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onClose: () => void;
  x: number;
  y: number;
  portalContainer?: HTMLElement | null;
}
 
function BlockActionsMenu({
  onMoveUp,
  onMoveDown,
  onDelete,
  onClose,
  x,
  y,
  portalContainer,
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
    <FloatingPortal x={x} y={y} container={portalContainer}>
      <div
        ref={ref}
        className="w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMoveUp();
            onClose();
          }}
        >
          ↑ Mover arriba
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMoveDown();
            onClose();
          }}
        >
          ↓ Mover abajo
        </button>
        <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
            onClose();
          }}
        >
          Eliminar bloque
        </button>
      </div>
    </FloatingPortal>
  );
}
 
// ─── Controles flotantes por bloque (+ y grip) ────────────────────────────────
// Se posicionan siguiendo el cursor, no el FloatingMenu de Tiptap.
 
interface BlockControlsProps {
  editor: Editor;
  disabled: boolean;
}
 
function BlockControls({ editor, disabled }: BlockControlsProps) {
  const [hoveredBlockIndex, setHoveredBlockIndex] = useState<number | null>(null);
  const [controlsY, setControlsY] = useState(0);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const [blockMenu, setBlockMenu] = useState<BlockMenuState>({
    open: false,
    x: 0,
    y: 0,
  });
  const [actionsMenu, setActionsMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
  }>({ open: false, x: 0, y: 0 });
  const portalContainer = editor.view.dom.closest("[data-slot='dialog-content']") as HTMLElement | null;
 
  const BLOCK_OPTIONS = useBlockOptions(editor);

  const clearHideTimer = useCallback(() => {
    if (hideControlsTimeoutRef.current !== null) {
      window.clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);
 
  // Detectar sobre qué bloque está el mouse
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (disabled || !editor.view) return;
      const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      let index = -1;

      if (pos) {
        index = getBlockIndexAtPos(editor, pos.pos);
      } else {
        // Si pos es null, el mouse está en el espacio vacío debajo del texto.
        // Asumimos el último bloque del documento.
        const childCount = editor.state.doc.childCount;
        if (childCount > 0) {
          index = childCount - 1;
        }
      }

      if (index === -1) {
        setHoveredBlockIndex(null);
        return;
      }
      setHoveredBlockIndex(index);
 
      // Calcular Y del bloque en pantalla
      const range = getBlockRange(editor, index);
      if (range) {
        if (!pos) {
          // Hover en espacio vacío: alineamos el botón en la parte INFERIOR del último bloque
          const coords = editor.view.coordsAtPos(range.to);
          setControlsY(coords.bottom + 4);
        } else {
          // Hover normal: alineamos en la parte SUPERIOR del bloque
          const coords = editor.view.coordsAtPos(range.from);
          setControlsY(coords.top);
        }
      }
    },
    [editor, disabled]
  );
 
  const handleMouseLeave = useCallback(() => {
    clearHideTimer();
    hideControlsTimeoutRef.current = window.setTimeout(() => {
      if (!blockMenu.open && !actionsMenu.open && !isHoveringControls) {
        setHoveredBlockIndex(null);
      }
    }, 140);
  }, [actionsMenu.open, blockMenu.open, clearHideTimer, isHoveringControls]);
 
  useEffect(() => {
    const editorEl = editor.view.dom;
    editorEl.addEventListener("mousemove", handleMouseMove as EventListener);
    editorEl.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      editorEl.removeEventListener("mousemove", handleMouseMove as EventListener);
      editorEl.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [editor, handleMouseMove, handleMouseLeave]);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);
 
  const openBlockMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hoveredBlockIndex !== null) {
        const range = getBlockRange(editor, hoveredBlockIndex);
        if (range) {
          // Movemos el cursor justo al final del bloque
          editor.commands.setTextSelection(range.to);
          editor.commands.focus();
        }
      }
      setActionsMenu((s) => ({ ...s, open: false }));
      setBlockMenu({
        open: true,
        x: e.clientX + 8,
        y: e.clientY,
      });
    },
    [editor, hoveredBlockIndex]
  );
 
  const openActionsMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (hoveredBlockIndex !== null) {
        const range = getBlockRange(editor, hoveredBlockIndex);
        if (range) {
          editor.commands.setTextSelection(range.from);
          editor.commands.focus();
        }
      }
      setBlockMenu((s) => ({ ...s, open: false }));
      setActionsMenu({
        open: true,
        x: e.clientX + 8,
        y: e.clientY,
      });
    },
    [editor, hoveredBlockIndex]
  );
 
  const handleSelectBlock = useCallback(
    (option: BlockOption) => {
      if (!editor) return;
      const { selection, doc } = editor.state;
      const node = doc.nodeAt(selection.from - 1) || doc.nodeAt(selection.from);
      const isEmpty = node?.isTextblock && node.textContent === "";
 
      if (isEmpty) {
        // Bloque vacío: solo cambiamos el tipo
        option.apply(editor);
      } else {
        // Bloque con contenido: insertamos un párrafo nuevo justo debajo
        editor.chain().focus().insertContent({ type: "paragraph" }).run();
        // Le aplicamos la opción al bloque nuevecito que acabamos de crear
        option.apply(editor);
      }
 
      setBlockMenu({ open: false, x: 0, y: 0 });
 
      // Si el bloque se abrió via slash command, borrar el "/"
      const { state } = editor;
      const { from: curFrom } = state.selection;
      const textBefore = state.doc.textBetween(
        Math.max(0, curFrom - 1),
        curFrom
      );
      if (textBefore === "/") {
        editor.commands.deleteRange({ from: curFrom - 1, to: curFrom });
      }
    },
    [editor]
  );
 
  const deleteBlock = useCallback(() => {
    const { selection } = editor.state;
    const index = getBlockIndexAtPos(editor, selection.from);
    if (index === -1) return;
    const range = getBlockRange(editor, index);
    if (!range) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: range.from - 1, to: range.to })
      .run();
  }, [editor]);
 
  if (disabled) return null;
 
  const showControls = hoveredBlockIndex !== null || blockMenu.open || actionsMenu.open;
 
  return (
    <>
      {/* Botones flotantes a la izquierda del editor */}
      {showControls && (
        <div
          className="pointer-events-auto absolute flex items-center gap-0.5"
          style={{
            // Posición fija relativa al viewport, alineada al bloque
            position: "fixed",
            top: controlsY,
            // La posición X se calcula en el contenedor relativo
            left: "var(--editor-controls-left, 0px)",
            transform: "translateY(-2px)",
            zIndex: 40,
          }}
          onMouseEnter={() => {
            clearHideTimer();
            setIsHoveringControls(true);
          }}
          onMouseLeave={() => {
            setIsHoveringControls(false);
            if (!blockMenu.open && !actionsMenu.open) {
              setHoveredBlockIndex(null);
            }
          }}
        >
          <button
            type="button"
            aria-label="Agregar bloque"
            title="Agregar bloque"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openBlockMenu}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Opciones de bloque"
            title="Mover o eliminar bloque"
            className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openActionsMenu}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
 
      {/* Menú de tipos de bloque */}
      {blockMenu.open && (
        <BlockMenu
          options={BLOCK_OPTIONS}
          onSelect={handleSelectBlock}
          onClose={() => setBlockMenu({ open: false, x: 0, y: 0 })}
          x={blockMenu.x}
          y={blockMenu.y}
          portalContainer={portalContainer}
        />
      )}
 
      {/* Menú de acciones del bloque */}
      {actionsMenu.open && (
        <BlockActionsMenu
          onMoveUp={() => moveBlock(editor, "up")}
          onMoveDown={() => moveBlock(editor, "down")}
          onDelete={deleteBlock}
          onClose={() => setActionsMenu({ open: false, x: 0, y: 0 })}
          x={actionsMenu.x}
          y={actionsMenu.y}
          portalContainer={portalContainer}
        />
      )}
    </>
  );
}
 
// ─── Hook: opciones de bloques ────────────────────────────────────────────────
 
function useBlockOptions(editor: Editor | null): BlockOption[] {
  return useMemo<BlockOption[]>(() => {
    if (!editor) return [];
    return [
      {
        id: "paragraph",
        label: "Párrafo",
        description: "Texto normal",
        group: "basic",
        keywords: ["texto", "normal", "paragraph", "parrafo", "p"],
        icon: Pilcrow,
        apply: (e) => e.chain().focus().setParagraph().run(),
      },
      {
        id: "heading-2",
        label: "Título grande",
        description: "Encabezado H2",
        group: "basic",
        keywords: ["titulo", "heading", "h2", "grande"],
        icon: Heading2,
        apply: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        id: "heading-3",
        label: "Título mediano",
        description: "Encabezado H3",
        group: "basic",
        keywords: ["titulo", "heading", "h3", "mediano"],
        icon: Heading3,
        apply: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        id: "divider",
        label: "Divisor",
        description: "Línea horizontal",
        group: "basic",
        keywords: ["divisor", "separador", "hr", "linea"],
        icon: Minus,
        apply: (e) => e.chain().focus().setHorizontalRule().run(),
      },
      {
        id: "bullet-list",
        label: "Lista",
        description: "Lista con viñetas",
        group: "lists",
        keywords: ["lista", "bullet", "ul", "viñeta"],
        icon: List,
        apply: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        id: "ordered-list",
        label: "Lista numerada",
        description: "Lista con números",
        group: "lists",
        keywords: ["lista", "numerada", "ordered", "ol", "numero"],
        icon: ListOrdered,
        apply: (e) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        id: "task-list",
        label: "Checklist",
        description: "Lista con casillas",
        group: "lists",
        keywords: ["check", "tarea", "todo", "checklist", "casilla"],
        icon: CheckSquare2,
        apply: (e) => e.chain().focus().toggleTaskList().run(),
      },
      {
        id: "quote",
        label: "Cita",
        description: "Bloque de cita",
        group: "advanced",
        keywords: ["quote", "cita", "blockquote"],
        icon: Quote,
        apply: (e) => e.chain().focus().toggleBlockquote().run(),
      },
      {
        id: "code",
        label: "Código",
        description: "Bloque de código",
        group: "advanced",
        keywords: ["code", "codigo", "snippet", "bloque", "pre"],
        icon: Code2,
        apply: (e) => e.chain().focus().toggleCodeBlock().run(),
      },
    ];
  }, [editor]);
}
 
// ─── Estilos CSS del editor ───────────────────────────────────────────────────
// Se inyectan como <style> global una sola vez.
 
const EDITOR_STYLES = `
.tf-editor .tiptap {
  outline: none;
  min-height: 220px;
  padding: 0;
  font-size: 15px;
  line-height: 1.75;
  color: #1c1c1e;
}
 
.dark .tf-editor .tiptap {
  color: #f4f4f5;
}
 
/* Placeholder */
.tf-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: #a1a1aa;
  float: left;
  height: 0;
  pointer-events: none;
}
 
/* Párrafos */
.tf-editor .tiptap p {
  margin: 0 0 0.25rem 0;
}
 
/* Headings */
.tf-editor .tiptap h2 {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  margin: 1.5rem 0 0.5rem;
  color: #111827;
}
.dark .tf-editor .tiptap h2 {
  color: #f9fafb;
}
.tf-editor .tiptap h3 {
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.4;
  margin: 1.25rem 0 0.4rem;
  color: #1f2937;
}
.dark .tf-editor .tiptap h3 {
  color: #f3f4f6;
}
 
/* Listas */
.tf-editor .tiptap ul,
.tf-editor .tiptap ol {
  margin: 0.25rem 0 0.5rem 1.5rem;
  padding: 0;
}
.tf-editor .tiptap ul { list-style-type: disc; }
.tf-editor .tiptap ol { list-style-type: decimal; }
.tf-editor .tiptap li { margin: 0.1rem 0; }
.tf-editor .tiptap li > p { margin: 0; }
 
/* Checklist */
.tf-editor .tiptap ul[data-type="taskList"] {
  list-style: none;
  margin-left: 0;
}
.tf-editor .tiptap ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.tf-editor .tiptap ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 0.25rem;
}
.tf-editor .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
  accent-color: #2563eb;
}
.tf-editor .tiptap ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through;
  color: #9ca3af;
}
 
/* Blockquote */
.tf-editor .tiptap blockquote {
  border-left: 3px solid #e4e4e7;
  padding-left: 1rem;
  margin: 0.5rem 0;
  color: #71717a;
  font-style: italic;
}
.dark .tf-editor .tiptap blockquote {
  border-left-color: #3f3f46;
  color: #a1a1aa;
}
 
/* Código inline */
.tf-editor .tiptap code {
  background: #f4f4f5;
  border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 0.85em;
  color: #dc2626;
}
.dark .tf-editor .tiptap code {
  background: #27272a;
  color: #f87171;
}
 
/* Bloque de código */
.tf-editor .tiptap pre {
  background: #18181b;
  border-radius: 0.5rem;
  padding: 1rem 1.25rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}
.tf-editor .tiptap pre code {
  background: none;
  color: #e4e4e7;
  padding: 0;
  font-size: 0.875rem;
}
 
/* HR */
.tf-editor .tiptap hr {
  border: none;
  border-top: 1px solid #e4e4e7;
  margin: 1rem 0;
}
.dark .tf-editor .tiptap hr {
  border-top-color: #3f3f46;
}
 
/* Links */
.tf-editor .tiptap a {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.tf-editor .tiptap a:hover {
  color: #1d4ed8;
}
 
/* Selección */
.tf-editor .tiptap ::selection {
  background: #bfdbfe;
}
.dark .tf-editor .tiptap ::selection {
  background: #1e40af40;
}
 
/* Drop cursor */
.tf-editor .tiptap .ProseMirror-dropcursor {
  border-top: 2px solid #3b82f6;
}
`;
 
// ─── Componente principal ─────────────────────────────────────────────────────
 
export function TicketRichEditor({
  value,
  placeholder = "Escribe algo, o presiona '/' para insertar un bloque...",
  disabled = false,
  isLocked = false,
  lockHint,
  onChange,
  onFocus,
  onBlur,
}: TicketRichEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
 
  // Calcular la posición X de los controles flotantes
  useEffect(() => {
    if (!containerRef.current) return;
    const updateLeft = () => {
      const rect = containerRef.current!.getBoundingClientRect();
      // Los botones van a 52px a la izquierda del borde del contenedor
      containerRef.current!.style.setProperty(
        "--editor-controls-left",
        `${rect.left - 56}px`
      );
    };
    updateLeft();
    const ro = new ResizeObserver(updateLeft);
    ro.observe(containerRef.current);

    const dialogContainer = containerRef.current.closest("[data-slot='dialog-content']") as HTMLElement | null;
    setPortalContainer(dialogContainer);

    return () => ro.disconnect();
  }, []);
 
  // Slash command state
  const [slashMenu, setSlashMenu] = useState<BlockMenuState>({
    open: false,
    x: 0,
    y: 0,
  });
 
  const handleSlashTrigger = useCallback(
    (coords: { x: number; y: number }) => {
      setSlashMenu({ open: true, x: coords.x, y: coords.y });
    },
    []
  );
 
  const handleSlashClose = useCallback(() => {
    setSlashMenu({ open: false, x: 0, y: 0 });
  }, []);
 
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Deshabilitar dropcursor del StarterKit para usar el nuestro
        dropcursor: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
        // Placeholder solo en el primer bloque vacío
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),
      Dropcursor.configure({ color: "#3b82f6", width: 2 }),
      TaskList,
      TaskItem.configure({ nested: true }),
      SlashCommandExtension.configure({
        onTrigger: handleSlashTrigger,
        onClose: handleSlashClose,
      }),
    ],
    // Contenido inicial desde JSON de ProseMirror
    content: value ?? "",
    editable: !disabled && !isLocked,
    onUpdate: ({ editor: e }) => {
      // Emitir JSON, no HTML
      onChangeRef.current(e.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "true",
      },
    },
    onFocus: () => onFocus?.(),
    onBlur: () => onBlur?.(),
    immediatelyRender: false,
  });
 
  // Sincronizar valor externo → editor
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(value);
    if (current === incoming) return;
    editor.commands.setContent(value ?? "", false);
  }, [editor, value]);
 
  // Sincronizar editable
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && !isLocked);
  }, [editor, disabled, isLocked]);
 
  const BLOCK_OPTIONS = useBlockOptions(editor);
 
  const handleSlashSelect = useCallback(
    (option: BlockOption) => {
      if (!editor) return;
      const { $from } = editor.state.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset);
      const slashIndex = textBefore.lastIndexOf("/");

      if (slashIndex !== -1) {
        const absoluteSlashPos = $from.start() + slashIndex;
        editor.commands.deleteRange({ from: absoluteSlashPos, to: $from.pos });
      }

      option.apply(editor);
      setSlashMenu({ open: false, x: 0, y: 0 });
    },
    [editor]
  );
 
  return (
    <div className="relative">
      <style suppressHydrationWarning>{EDITOR_STYLES}</style>
      {isLocked && (
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          {lockHint ?? "Otro usuario está editando este contenido."}
        </p>
      )}
 
      {/* Controles flotantes por bloque (hover) */}
      {editor && !disabled && !isLocked && (
        <BlockControls editor={editor} disabled={disabled || isLocked} />
      )}
 
      {/* Área del editor */}
      <div
        ref={containerRef}
        className={cn(
          "tf-editor relative cursor-text",
          // Padding izquierdo generoso para que los botones no sobrepongan el texto
          "pl-6",
          disabled && "pointer-events-none opacity-60"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget && editor) {
            editor.commands.focus("end");
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
 
      {/* Menú de slash command */}
      {slashMenu.open && editor && (
        <BlockMenu
          options={BLOCK_OPTIONS}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
          x={slashMenu.x}
          y={slashMenu.y}
          portalContainer={portalContainer}
        />
      )}
    </div>
  );
}