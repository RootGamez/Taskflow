/**
 * blockOptions.tsx
 *
 * Catálogo único de bloques insertables. Lo consumen el menú de "/"
 * (`SlashCommandMenu`) y el botón "+" (`BlockControls`).
 *
 * Fase 1: antes vivía en `RichEditor.tsx` como `useBlockOptions` y se
 * llamaba DOS veces — una con `editor = null` (solo para construir la lista
 * que recibe `SlashExtension` al crear el editor) y otra con el editor ya
 * vivo. Como ninguna opción usaba realmente el `editor` del argumento (todas
 * reciben el editor en `apply(e)`), el parámetro era ruido que invitaba a
 * bugs de "lista vacía en el primer render". Aquí ya no existe.
 */

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import {
  CheckSquare2,
  Code2,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table as TableIcon,
  Link as LinkIcon,
  Video as VideoIcon,
} from "lucide-react";

import type { SlashCommandItem } from "../extensions/SlashExtension";
import type { RequestUrlFn } from "../hooks/useUrlPrompt";
import { normalizeUrl } from "./url";

interface BlockOptionsConfig {
  /** Si falta, las opciones de media no se ofrecen. */
  canUploadMedia: boolean;
  onPickImage?: (() => void) | null;
  onPickVideo?: (() => void) | null;
  requestUrl?: RequestUrlFn;
}

export function useBlockOptions({
  canUploadMedia,
  onPickImage,
  onPickVideo,
  requestUrl,
}: BlockOptionsConfig): SlashCommandItem[] {
  return useMemo<SlashCommandItem[]>(() => {
    const options: SlashCommandItem[] = [
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
        description: "Bloque de código con resaltado",
        group: "advanced",
        keywords: ["code", "codigo", "snippet", "bloque", "pre"],
        icon: Code2,
        apply: (e) => e.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "table",
        label: "Tabla",
        description: "Insertar una tabla 3×3",
        group: "advanced",
        keywords: ["tabla", "table", "grid", "filas", "columnas"],
        icon: TableIcon,
        apply: (e) =>
          e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: "bookmark",
        label: "Enlace visual",
        description: "Tarjeta de vista previa web",
        group: "advanced",
        keywords: ["bookmark", "enlace", "link", "tarjeta", "card", "ogp"],
        icon: LinkIcon,
        apply: (e: Editor) => {
          void requestUrl?.("URL para previsualizar").then((url) => {
            const safe = normalizeUrl(url);
            if (safe) {
              e.chain().focus().insertContent({ type: "bookmark", attrs: { url: safe } }).run();
            }
          });
        },
      },
    ];

    if (canUploadMedia) {
      options.push(
        {
          id: "image",
          label: "Imagen",
          description: "Sube una imagen desde tu equipo",
          group: "media",
          keywords: ["imagen", "foto", "image", "picture", "img", "upload"],
          icon: ImageIcon,
          apply: () => onPickImage?.(),
        },
        {
          id: "video",
          label: "Video",
          description: "Sube un video (MP4, WebM, MOV...)",
          group: "media",
          keywords: ["video", "mp4", "webm", "mov", "pelicula", "clip", "upload"],
          icon: VideoIcon,
          apply: () => onPickVideo?.(),
        },
      );
    }

    return options;
  }, [canUploadMedia, onPickImage, onPickVideo, requestUrl]);
}
