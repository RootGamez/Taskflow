import { describe, expect, it, vi } from "vitest";
import { Extension } from "@tiptap/core";
import type { AnyExtension } from "@tiptap/core";

import {
  MAX_DOC_CHARS,
  SUPPORTED_CODE_LANGUAGES,
  createEditorExtensions,
  type EditorExtensionsConfig,
} from "../createEditorExtensions";

function build(overrides: Partial<EditorExtensionsConfig> = {}): AnyExtension[] {
  const config: EditorExtensionsConfig = {
    placeholder: "Escribe algo…",
    getBlockOptions: () => [],
    getMentionItems: () => [],
    slashRenderer: () => ({}),
    mentionRenderer: () => ({}),
    ...overrides,
  };
  return createEditorExtensions(config);
}

const names = (exts: AnyExtension[]): string[] => exts.map((ext) => ext.name);

function find(exts: AnyExtension[], name: string): AnyExtension {
  const found = exts.find((ext) => ext.name === name);
  if (!found) throw new Error(`No se encontró la extensión "${name}"`);
  return found;
}

const EXPECTED_NAMES = [
  "starterKit",
  "highlight",
  "textAlign",
  "codeBlock",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "taskList",
  "taskItem",
  "trailingNode",
  "characterCount",
  "dropCursor",
  "placeholder",
  "mention",
  "image",
  "bookmark",
  "video",
  "file",
  "subscript",
  "superscript",
  "typography",
  "textStyleKit",
  "details",
  "detailsSummary",
  "detailsContent",
  // Ojo con la mayuscula: `@tiptap/extension-mathematics` registra su
  // extension como "Mathematics", a diferencia de todas las demas. Un
  // test que busque "mathematics" en minuscula falla.
  "Mathematics",
  "youtube",
  "emoji",
  "slashCommand",
];

describe("createEditorExtensions", () => {
  it("incluye todos los nodos, marcas y extensiones esperados del esquema", () => {
    const exts = build();

    expect(names(exts)).toEqual(expect.arrayContaining(EXPECTED_NAMES));
  });

  it("no arrastra extensiones extra ni duplicados cuando no se pasan extraExtensions", () => {
    const list = names(build());

    expect(list).toHaveLength(EXPECTED_NAMES.length);
    expect(new Set(list).size).toBe(list.length);
  });

  it("registra la tabla con sus cuatro nodos", () => {
    const list = names(build());

    expect(list).toEqual(
      expect.arrayContaining(["table", "tableRow", "tableHeader", "tableCell"]),
    );
  });

  it("reemplaza el codeBlock de StarterKit por CodeBlockLowlight", () => {
    const exts = build();

    expect(find(exts, "starterKit").options.codeBlock).toBe(false);
    const codeBlock = find(exts, "codeBlock");
    expect(codeBlock.type).toBe("node");
    expect(codeBlock.options.lowlight).toBeDefined();
    expect(codeBlock.options.defaultLanguage).toBe("plaintext");
  });

  it("limita StarterKit a los encabezados H2 y H3", () => {
    const starterKit = find(build(), "starterKit");

    expect(starterKit.options.heading).toEqual({ levels: [2, 3] });
  });

  it("desactiva el dropcursor de StarterKit y añade uno propio con el color de marca", () => {
    const exts = build();

    expect(find(exts, "starterKit").options.dropcursor).toBe(false);
    const dropCursor = find(exts, "dropCursor");
    expect(dropCursor.options.color).toBe("hsl(var(--primary))");
    expect(dropCursor.options.width).toBe(2);
  });

  it("configura CharacterCount con el límite de MAX_DOC_CHARS", () => {
    const characterCount = find(build(), "characterCount");

    expect(MAX_DOC_CHARS).toBe(100_000);
    expect(characterCount.options.limit).toBe(MAX_DOC_CHARS);
  });

  it("propaga el placeholder recibido a la extensión Placeholder", () => {
    const placeholder = find(build({ placeholder: "Redacta el ticket…" }), "placeholder");

    expect(placeholder.options.placeholder).toBe("Redacta el ticket…");
  });

  it("mantiene el enlace de StarterKit sin abrir al hacer click y con autolink", () => {
    const starterKit = find(build(), "starterKit");

    expect(starterKit.options.link).toMatchObject({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    });
  });

  it("permite tablas redimensionables y task items anidados", () => {
    const exts = build();

    expect(find(exts, "table").options.resizable).toBe(true);
    expect(find(exts, "taskItem").options.nested).toBe(true);
  });

  it("concatena extraExtensions al final de la lista", () => {
    const extraA = Extension.create({ name: "colabExtra" });
    const extraB = Extension.create({ name: "pasteUploadExtra" });

    const list = names(build({ extraExtensions: [extraA, extraB] }));

    expect(list).toHaveLength(EXPECTED_NAMES.length + 2);
    expect(list.slice(-2)).toEqual(["colabExtra", "pasteUploadExtra"]);
  });

  it("acepta la ausencia de extraExtensions sin romper la lista base", () => {
    expect(names(build({ extraExtensions: undefined }))).toHaveLength(EXPECTED_NAMES.length);
  });

  it("cablea getBlockOptions dentro del suggestion del slash command", () => {
    const getBlockOptions = vi.fn(() => []);
    const slash = find(build({ getBlockOptions }), "slashCommand");

    const suggestion = slash.options.suggestion as {
      char: string;
      items: (args: { query: string }) => unknown[];
    };
    expect(suggestion.char).toBe("/");
    suggestion.items({ query: "" });
    expect(getBlockOptions).toHaveBeenCalled();
  });

  it("expone el catálogo de lenguajes de código con plaintext primero", () => {
    expect(SUPPORTED_CODE_LANGUAGES[0]).toEqual({ value: "plaintext", label: "Texto plano" });
    expect(SUPPORTED_CODE_LANGUAGES.map((lang) => lang.value)).toEqual(
      expect.arrayContaining(["typescript", "javascript", "python", "json", "bash", "sql"]),
    );
  });
});
