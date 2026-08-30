"use client";

/**
 * FormatBubbleMenu.tsx
 *
 * Barra flotante de formato de texto sobre la selección, con tres estados:
 * botones de marca/alineación, edición de URL, y detalle del enlace activo.
 * Extraída de `RichEditor.tsx` en la Fase 1 del repotenciado.
 */

import { useCallback, useState } from "react";
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
  Strikethrough as StrikethroughIcon,
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

const MARK_NAMES = ["bold", "italic", "underline", "strike", "code", "highlight"] as const;
const ALIGN_VALUES = ["left", "center", "right"] as const;

export function FormatBubbleMenu({ editor }: FormatBubbleMenuProps) {
  const [isEditingLink, setEditingLink] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState("");

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
    }),
  });

  const activeMarks = state?.activeMarks ?? {};
  const activeAlign = state?.activeAlign ?? null;
  const isLinkActive = state?.isLink ?? false;
  const linkHref = state?.linkHref ?? "";

  const applyLink = useCallback(() => {
    const safe = normalizeUrl(linkInputUrl);
    if (safe) {
      editor.chain().focus().setLink({ href: safe, target: "_blank" }).run();
    } else if (!linkInputUrl.trim()) {
      editor.chain().focus().unsetLink().run();
    }
    setEditingLink(false);
    setLinkInputUrl("");
  }, [editor, linkInputUrl]);

  const marks = [
    { icon: BoldIcon, label: "Negrita", is: "bold", run: () => editor.chain().focus().toggleBold().run() },
    { icon: ItalicIcon, label: "Cursiva", is: "italic", run: () => editor.chain().focus().toggleItalic().run() },
    { icon: UnderlineIcon, label: "Subrayado", is: "underline", run: () => editor.chain().focus().toggleUnderline().run() },
    { icon: StrikethroughIcon, label: "Tachado", is: "strike", run: () => editor.chain().focus().toggleStrike().run() },
    { icon: InlineCodeIcon, label: "Código", is: "code", run: () => editor.chain().focus().toggleCode().run() },
    { icon: HighlighterIcon, label: "Resaltar", is: "highlight", run: () => editor.chain().focus().toggleHighlight().run() },
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
      className="z-50 flex items-center gap-0.5 overflow-hidden rounded border-2 border-border bg-popover p-1 text-popover-foreground shadow-hard dark:shadow-hard-float"
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
        <div className="flex items-center gap-2 p-1">
          <Input
            autoFocus
            type="url"
            value={linkInputUrl}
            onChange={(e) => setLinkInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyLink();
              if (e.key === "Escape") setEditingLink(false);
            }}
            className="h-8 w-64"
            placeholder="https://..."
          />
          <Button onClick={applyLink} size="sm">
            Guardar
          </Button>
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
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="h-7 w-7 rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            title="Eliminar enlace"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </BubbleMenu>
  );
}
