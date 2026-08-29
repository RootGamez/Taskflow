import type { AnyExtension } from "@tiptap/core";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import CharacterCount from "@tiptap/extension-character-count";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { createLowlight } from "lowlight";

import { TrailingNode } from "../extensions/TrailingNode";

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

/**
 * Extensiones que son idénticas en el editor de tickets y en el de creación
 * (evita que las dos listas duplicadas sigan divergiendo — deuda registrada
 * en el plan de Tiptap). El resto de la config (StarterKit, media, slash)
 * sigue viviendo en cada componente porque difiere de verdad (subida vs
 * base64, opciones de bloque distintas).
 *
 * IMPORTANTE: quien use esto debe `StarterKit.configure({ codeBlock: false })`
 * — `CodeBlockLowlight` reemplaza al `codeBlock` plano y comparte nombre de
 * nodo, así que los documentos existentes siguen siendo compatibles.
 */

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

export function createSharedExtensions(): AnyExtension[] {
  return [
    Underline,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
    Table.configure({ resizable: true, lastColumnResizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    TrailingNode,
    CharacterCount,
  ];
}
