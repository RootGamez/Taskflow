/**
 * createEditorExtensions.ts
 *
 * Fuente UNICA de verdad del esquema del editor. Antes la lista estaba
 * partida en dos (`sharedExtensions.ts` + una lista inline de 140 lineas
 * dentro de `RichEditor.tsx`), lo que ya habia provocado divergencias entre
 * el editor de tickets y el de paginas. Ahora hay una sola funcion y las
 * diferencias reales se expresan como opciones.
 *
 * `CodeBlockLowlight` reemplaza al `codeBlock` de StarterKit (mismo nombre
 * de nodo, asi que los documentos guardados siguen siendo validos), por eso
 * StarterKit se configura con `codeBlock: false`.
 *
 * Tiptap v3: `Underline`, `Link` y `ListKeymap` ya vienen dentro de
 * `StarterKit`; `CharacterCount`, `TrailingNode`, `Placeholder` y
 * `Dropcursor` viven en `@tiptap/extensions`; las 4 piezas de tabla y las
 * de lista salen de `@tiptap/extension-table` y `@tiptap/extension-list`.
 */

import type { AnyExtension, Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Mention from "@tiptap/extension-mention";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Table, TableRow, TableHeader, TableCell } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { CharacterCount, Dropcursor, Placeholder, TrailingNode } from "@tiptap/extensions";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Emoji, gitHubEmojis } from "@tiptap/extension-emoji";
import { Mathematics } from "@tiptap/extension-mathematics";
import Youtube from "@tiptap/extension-youtube";
import Typography from "@tiptap/extension-typography";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { createLowlight } from "lowlight";

import ts from "highlight.js/lib/languages/typescript";
import js from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";

import { BookmarkExtension } from "./BookmarkExtension";
import { FileExtension } from "./FileExtension";
import { SlashExtension, type SlashCommandItem } from "./SlashExtension";
import { VideoExtension } from "./VideoExtension";
import { CodeBlockNodeView } from "../components/CodeBlockNodeView";
import { ImageNodeView } from "../components/ImageNodeView";
import type { MentionItem } from "../components/MentionList";

// Registro selectivo: `common`/`all` de highlight.js pesan ~1MB. Estos 10
// cubren el 99% de lo que se pega en un ticket.
const lowlight = createLowlight();
lowlight.register({
  typescript: ts,
  javascript: js,
  python,
  json,
  bash,
  sql,
  css,
  xml,
  yaml,
  markdown,
});

export const SUPPORTED_CODE_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "plaintext", label: "Texto plano" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "bash", label: "Bash" },
  { value: "sql", label: "SQL" },
  { value: "css", label: "CSS" },
  { value: "xml", label: "HTML / XML" },
  { value: "yaml", label: "YAML" },
  { value: "markdown", label: "Markdown" },
];

/**
 * Tope de caracteres del documento. Antes `CharacterCount` se montaba sin
 * `limit`, asi que el contador era decorativo: nada impedia pegar un
 * documento de megabytes que el backend guarda en un `TextField` sin
 * `max_length`. La Fase 6 pondra la validacion equivalente en el servidor --
 * este limite es la primera barrera, no la unica.
 */
export const MAX_DOC_CHARS = 100_000;

/** Maximo de menciones ofrecidas en el desplegable de arroba. */
const MAX_MENTION_SUGGESTIONS = 8;

// El tipo real de `render` de @tiptap/suggestion es generico y ruidoso; lo
// que importa aqui es que sea la factory que devuelven
// `createSlashMenuRenderer` / `createMentionRenderer`.
type SuggestionRendererFactory = () => Record<string, unknown>;

export interface EditorExtensionsConfig {
  placeholder: string;
  /** Tope de caracteres del documento. Por defecto `MAX_DOC_CHARS`. */
  characterLimit?: number;
  /** Items del menu de barra. Se leen en cada pulsacion. */
  getBlockOptions: () => SlashCommandItem[];
  /** Miembros mencionables. Vacio = menciones inertes. */
  getMentionItems: () => MentionItem[];
  /** `render` del suggestion de barra (ver SlashCommandMenu). */
  slashRenderer: SuggestionRendererFactory;
  /** `render` del suggestion de arroba (ver MentionList). */
  mentionRenderer: SuggestionRendererFactory;
  /** `render` del suggestion de dos puntos para emojis. Opcional. */
  emojiRenderer?: SuggestionRendererFactory;
  /** Plugins extra (subida por pegado/arrastre, colaboracion...). */
  extraExtensions?: AnyExtension[];
}

export function createEditorExtensions(config: EditorExtensionsConfig): AnyExtension[] {
  const {
    placeholder,
    characterLimit = MAX_DOC_CHARS,
    getBlockOptions,
    getMentionItems,
    slashRenderer,
    mentionRenderer,
    emojiRenderer,
    extraExtensions = [],
  } = config;

  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Se anade suelto abajo con el color de marca y grosor 2px.
      dropcursor: false,
      // Reemplazado por CodeBlockLowlight (mismo nombre de nodo).
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class:
            "cursor-pointer font-medium text-primary hover:opacity-80 underline underline-offset-2",
        },
      },
    }),

    // `multicolor` activo: el usuario elige el color del resaltado desde la
    // barra flotante, no hay un unico amarillo.
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,

    // Comillas tipograficas, guiones largos, flechas y fracciones al
    // escribir. Puramente de entrada: no cambia el esquema.
    Typography,

    // Habilita el atributo `color` del texto (y de paso font-family,
    // font-size y line-height, que quedan disponibles para mas adelante).
    TextStyleKit,

    // Secciones plegables. `Details` necesita sus dos hijos declarados:
    // el resumen visible y el contenido que se colapsa.
    Details.configure({
      persist: true,
      HTMLAttributes: { class: "tf-details" },
    }),
    DetailsSummary,
    DetailsContent,

    // Formulas KaTeX, inline (`$...$`) y en bloque (`$$...$$`).
    Mathematics,

    Youtube.configure({
      controls: true,
      nocookie: true,
      // Sin esto el iframe desborda el contenedor en movil.
      width: 640,
      height: 360,
    }),

    Emoji.configure({
      emojis: gitHubEmojis,
      enableEmoticons: true,
      suggestion: emojiRenderer ? { char: ":", render: emojiRenderer } : undefined,
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    // El NodeView anade la cabecera con selector de lenguaje y boton de
    // copiar; sin el, `SUPPORTED_CODE_LANGUAGES` no tenia ninguna UI.
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }).extend({
      addNodeView() {
        return ReactNodeViewRenderer(CodeBlockNodeView);
      },
    }),

    Table.configure({ resizable: true, lastColumnResizable: false }),
    TableRow,
    TableHeader,
    TableCell,

    TaskList,
    TaskItem.configure({ nested: true }),

    TrailingNode,
    CharacterCount.configure({ limit: characterLimit }),
    Dropcursor.configure({ color: "hsl(var(--primary))", width: 2 }),
    Placeholder.configure({
      placeholder,
      emptyEditorClass: "is-editor-empty",
      showOnlyWhenEditable: true,
      showOnlyCurrent: false,
    }),

    Mention.configure({
      HTMLAttributes: { class: "tf-mention" },
      suggestion: {
        char: "@",
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          return getMentionItems()
            .filter((m) => m.label.toLowerCase().includes(q))
            .slice(0, MAX_MENTION_SUGGESTIONS);
        },
        render: mentionRenderer,
      },
    }),

    Image.configure({ inline: false, allowBase64: false }).extend({
      addNodeView() {
        return ReactNodeViewRenderer(ImageNodeView);
      },
    }),

    BookmarkExtension,
    VideoExtension,
    FileExtension,

    SlashExtension.configure({
      suggestion: {
        char: "/",
        startOfLine: true,
        allowSpaces: false,
        items: ({ query }: { query: string }) => {
          const options = getBlockOptions();
          if (!query) return options;
          const q = query.toLowerCase();
          return options.filter(
            (o) => o.label.toLowerCase().includes(q) || o.keywords.some((k) => k.includes(q)),
          );
        },
        render: slashRenderer,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: SlashCommandItem;
        }) => {
          editor.chain().focus().deleteRange(range).run();
          // `apply` es la UNICA via de ejecucion. Las opciones de media
          // abren el file picker ellas mismas (ver lib/blockOptions.tsx);
          // llamarlo tambien desde aqui disparaba `input.click()` dos veces
          // en el mismo tick, con comportamiento inconsistente entre
          // navegadores (dialogo doble, o ninguno).
          props.apply(editor);
        },
      },
    }),

    ...extraExtensions,
  ];
}
