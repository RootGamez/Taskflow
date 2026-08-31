"use client";

/**
 * FormatBubbleMenu.tsx
 *
 * Barra flotante de formato de texto sobre la selección, con tres estados:
 * botones de marca/alineación, edición de URL, y detalle del enlace activo.
 * Extraída de `RichEditor.tsx` en la Fase 1 del repotenciado.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold as BoldIcon,
  Code as InlineCodeIcon,
  ExternalLink,
  Highlighter as HighlighterIcon,
  Italic as ItalicIcon,
  Link as LinkIcon,
  Palette as PaletteIcon,
  Strikethrough as StrikethroughIcon,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Trash2,
  Underline as UnderlineIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { normalizeUrl } from "../lib/url";

interface FormatBubbleMenuProps {
  editor: Editor;
}

/** Clase compartida por los botones de icono de la barra. */
const ICON_BUTTON = "flex h-8 w-8 items-center justify-center rounded transition-colors";

const MARK_NAMES = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
  "subscript",
  "superscript",
] as const;
const ALIGN_VALUES = ["left", "center", "right"] as const;

/**
 * Paleta de texto y resaltado. Valores literales, no tokens: se guardan
 * en el JSON del documento y tienen que seguir significando lo mismo si
 * manana cambia el tema o el documento se exporta fuera de la app.
 * Elegidos para tener contraste suficiente sobre fondo claro y oscuro.
 */
const TEXT_COLORS = [
  { label: "Por defecto", value: null },
  { label: "Carmesí", value: "#B3261E" },
  { label: "Ámbar", value: "#A66300" },
  { label: "Verde", value: "#2E6E4E" },
  { label: "Azul", value: "#1F5FA8" },
  { label: "Violeta", value: "#6B4EA8" },
] as const;

const HIGHLIGHT_COLORS = [
  { label: "Sin resaltado", value: null },
  { label: "Amarillo", value: "#FDE68A" },
  { label: "Verde", value: "#BBF7D0" },
  { label: "Azul", value: "#BFDBFE" },
  { label: "Rosa", value: "#FBCFE8" },
  { label: "Gris", value: "#E5E7EB" },
] as const;

interface ColorSwatchesProps {
  label: string;
  icon: typeof HighlighterIcon;
  colors: readonly { readonly label: string; readonly value: string | null }[];
  activeValue: string | null;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onSelect: (value: string | null) => void;
}

/**
 * Muestras de color desplegables.
 *
 * Se abre con clic y no con hover: el panel se cerraba en cuanto el raton
 * salia del boton camino de las muestras, y en tactil no habia forma de
 * abrirlo. Se posiciona absoluto dentro de la barra, que ya es un elemento
 * flotante de Floating UI y por tanto vive en la capa correcta; lo unico
 * que faltaba era que la barra no recortase a sus hijos.
 */
function ColorSwatches({
  label,
  icon: Icon,
  colors,
  activeValue,
  isOpen,
  onToggle,
  onSelect,
}: ColorSwatchesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierra con Escape o con un clic fuera. En captura, para adelantarse a
  // los manejadores del editor.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onToggle(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onToggle(false);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onToggle(!isOpen)}
        className={cn(
          ICON_BUTTON,
          isOpen || activeValue
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="group"
          aria-label={label}
          className="absolute left-1/2 top-[calc(100%+0.4rem)] z-[60] flex -translate-x-1/2 gap-1 rounded border-2 border-border bg-popover p-1 shadow-hard dark:shadow-hard-float"
        >
          {colors.map((color) => (
            <button
              key={color.label}
              type="button"
              aria-label={color.label}
              aria-pressed={activeValue === color.value}
              title={color.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(color.value);
                onToggle(false);
              }}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition",
                activeValue === color.value
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-foreground",
              )}
              style={color.value ? { background: color.value } : undefined}
            >
              {/* La opcion "sin color" no tiene muestra que ensenar. */}
              {color.value ? null : (
                <span aria-hidden="true" className="text-xs text-muted-foreground">
                  &#215;
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FormatBubbleMenu({ editor }: FormatBubbleMenuProps) {
  const [isEditingLink, setEditingLink] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState("");
  // Un solo desplegable de color abierto a la vez.
  const [openSwatches, setOpenSwatches] = useState<"text" | "highlight" | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // La cascara (`RichEditor`) ya no se re-renderiza en cada transaccion, asi
  // que el estado activo de los botones se suscribe aqui y solo a lo que se
  // pinta: marcas, alineacion y el enlace bajo el cursor.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      activeMarks: Object.fromEntries(MARK_NAMES.map((m) => [m, e.isActive(m)])),
      activeAlign: ALIGN_VALUES.find((v) => e.isActive({ textAlign: v })) ?? null,
      isLink: e.isActive("link"),
      linkHref: (e.getAttributes("link").href as string | undefined) ?? "",
      textColor: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      highlightColor: (e.getAttributes("highlight").color as string | undefined) ?? null,
      // Se sigue la seleccion para poder salir del modo edicion de URL
      // cuando el usuario se mueve a otra parte del documento.
      from: e.state.selection.from,
      to: e.state.selection.to,
    }),
  });

  const activeMarks = state?.activeMarks ?? {};
  const activeAlign = state?.activeAlign ?? null;
  const isLinkActive = state?.isLink ?? false;
  const linkHref = state?.linkHref ?? "";
  const textColor = state?.textColor ?? null;
  const highlightColor = state?.highlightColor ?? null;
  const selectionFrom = state?.from ?? 0;
  const selectionTo = state?.to ?? 0;

  /**
   * Reinicia los modos de la barra al mover la seleccion.
   *
   * Sin esto, pulsar el boton de enlace sin querer dejaba la barra atrapada
   * en el campo de URL: `isEditingLink` no se limpiaba nunca porque el
   * componente no se desmonta al ocultarse la barra, asi que la siguiente
   * seleccion volvia a mostrar el campo en vez de los botones de formato y
   * no habia forma evidente de volver.
   *
   * Escribir en el campo no mueve la seleccion del editor, asi que esto no
   * interrumpe a quien esta escribiendo una URL de verdad.
   */
  useEffect(() => {
    setEditingLink(false);
    setLinkInputUrl("");
    setLinkError(null);
    setOpenSwatches(null);
  }, [selectionFrom, selectionTo]);

  /**
   * Quita el enlace bajo el cursor.
   *
   * `extendMarkRange("link")` es imprescindible: `unsetLink` opera sobre la
   * seleccion, y al hacer clic dentro de un enlace la seleccion queda
   * COLAPSADA, asi que sin extenderla al rango de la marca no se borraba
   * nada y el enlace parecia imposible de quitar.
   */
  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setEditingLink(false);
    setLinkInputUrl("");
    setLinkError(null);
  }, [editor]);

  const applyLink = useCallback(() => {
    // Input vacio = quitar el enlace. Es la salida natural cuando alguien
    // abrio el campo sin querer.
    if (!linkInputUrl.trim()) {
      removeLink();
      return;
    }

    const safe = normalizeUrl(linkInputUrl);
    if (!safe) {
      // Antes esto no hacia nada y cerraba el campo en silencio: el usuario
      // se quedaba sin enlace y sin saber por que.
      setLinkError("Escribe una URL válida (por ejemplo, ejemplo.com).");
      return;
    }

    // `extendMarkRange` tambien al aplicar: editar un enlace existente con
    // el cursor dentro debe reemplazarlo entero, no partirlo en dos.
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe, target: "_blank" }).run();
    setEditingLink(false);
    setLinkInputUrl("");
    setLinkError(null);
  }, [editor, linkInputUrl, removeLink]);

  const marks = [
    { icon: BoldIcon, label: "Negrita", is: "bold", run: () => editor.chain().focus().toggleBold().run() },
    { icon: ItalicIcon, label: "Cursiva", is: "italic", run: () => editor.chain().focus().toggleItalic().run() },
    { icon: UnderlineIcon, label: "Subrayado", is: "underline", run: () => editor.chain().focus().toggleUnderline().run() },
    { icon: StrikethroughIcon, label: "Tachado", is: "strike", run: () => editor.chain().focus().toggleStrike().run() },
    { icon: InlineCodeIcon, label: "Código", is: "code", run: () => editor.chain().focus().toggleCode().run() },
    { icon: SubscriptIcon, label: "Subíndice", is: "subscript", run: () => editor.chain().focus().toggleSubscript().run() },
    { icon: SuperscriptIcon, label: "Superíndice", is: "superscript", run: () => editor.chain().focus().toggleSuperscript().run() },
  ];

  const alignments = [
    { icon: AlignLeft, label: "Alinear a la izquierda", value: "left" },
    { icon: AlignCenter, label: "Centrar", value: "center" },
    { icon: AlignRight, label: "Alinear a la derecha", value: "right" },
  ];

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="formatBubble"
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e, state, from, to }) => {
        if (e.isActive("link")) return true;
        // Selección de texto no vacía y fuera de un bloque de código.
        if (from === to) return false;
        if (e.isActive("codeBlock")) return false;
        return state.doc.textBetween(from, to).trim().length > 0;
      }}
      className="z-50 flex items-center gap-0.5 rounded border-2 border-border bg-popover p-1 text-popover-foreground shadow-hard dark:shadow-hard-float"
    >
      {!isEditingLink && !isLinkActive ? (
        <div className="flex items-center gap-0.5">
          {marks.map(({ icon: Icon, label, is, run }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-pressed={activeMarks[is] ?? false}
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              className={cn(
                ICON_BUTTON,
                activeMarks[is]
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px bg-border" />
          {alignments.map(({ icon: Icon, label, value }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={activeAlign === value}
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign(value).run()}
              className={cn(
                ICON_BUTTON,
                activeAlign === value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px bg-border" />
          <ColorSwatches
            label="Color del texto"
            icon={PaletteIcon}
            colors={TEXT_COLORS}
            activeValue={textColor}
            isOpen={openSwatches === "text"}
            onToggle={(open) => setOpenSwatches(open ? "text" : null)}
            onSelect={(value) =>
              value
                ? editor.chain().focus().setColor(value).run()
                : editor.chain().focus().unsetColor().run()
            }
          />
          <ColorSwatches
            label="Resaltado"
            icon={HighlighterIcon}
            colors={HIGHLIGHT_COLORS}
            activeValue={highlightColor}
            isOpen={openSwatches === "highlight"}
            onToggle={(open) => setOpenSwatches(open ? "highlight" : null)}
            onSelect={(value) =>
              value
                ? editor.chain().focus().setHighlight({ color: value }).run()
                : editor.chain().focus().unsetHighlight().run()
            }
          />
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            aria-label="Añadir enlace"
            title="Añadir enlace"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setLinkInputUrl("");
              setEditingLink(true);
            }}
            className={cn(ICON_BUTTON, "text-muted-foreground hover:bg-accent hover:text-foreground")}
          >
            <LinkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : isEditingLink ? (
        <div className="p-1">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              type="url"
              value={linkInputUrl}
              onChange={(e) => {
                setLinkInputUrl(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyLink();
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setEditingLink(false);
                  setLinkError(null);
                }
              }}
              aria-invalid={linkError !== null}
              aria-describedby={linkError ? "tf-link-error" : undefined}
              className="h-8 w-64"
              placeholder="https://..."
            />
            <Button onClick={applyLink} size="sm">
              Guardar
            </Button>
            {/* Salida siempre visible: quita el enlace y cierra el campo,
                para quien abrio esto sin querer. */}
            <Button
              onClick={removeLink}
              size="sm"
              variant="ghost"
              title="Quitar enlace"
              aria-label="Quitar enlace"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {linkError ? (
            <p id="tf-link-error" role="alert" className="mt-1 px-1 text-xs text-destructive">
              {linkError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-1 p-1">
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-[200px] items-center gap-2 truncate rounded px-3 py-1.5 text-sm text-primary transition hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{linkHref}</span>
          </a>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLinkInputUrl(linkHref);
              setLinkError(null);
              setEditingLink(true);
            }}
            className="h-7 w-7 rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
            title="Editar enlace"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={removeLink}
            className="h-7 w-7 rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            title="Quitar enlace"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </BubbleMenu>
  );
}
