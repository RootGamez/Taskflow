import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/react";

import type { SlashCommandItem } from "../../extensions/SlashExtension";
import { useBlockOptions } from "../blockOptions";

interface Config {
  canUploadMedia: boolean;
  onPickImage?: (() => void) | null;
  onPickVideo?: (() => void) | null;
}

function getOptions(config: Config): SlashCommandItem[] {
  const { result } = renderHook(() => useBlockOptions(config));
  return result.current;
}

function byId(options: SlashCommandItem[], id: string): SlashCommandItem {
  const found = options.find((option) => option.id === id);
  if (!found) throw new Error(`No existe la opción "${id}"`);
  return found;
}

const BASE_IDS = [
  "paragraph",
  "heading-2",
  "heading-3",
  "divider",
  "bullet-list",
  "ordered-list",
  "task-list",
  "quote",
  "code",
  "table",
  "bookmark",
];

const EXPECTED_GROUPS: Record<string, SlashCommandItem["group"]> = {
  paragraph: "basic",
  "heading-2": "basic",
  "heading-3": "basic",
  divider: "basic",
  "bullet-list": "lists",
  "ordered-list": "lists",
  "task-list": "lists",
  quote: "advanced",
  code: "advanced",
  table: "advanced",
  bookmark: "advanced",
  image: "media",
  video: "media",
};

describe("useBlockOptions", () => {
  it("no ofrece las opciones de media cuando canUploadMedia es false", () => {
    const options = getOptions({ canUploadMedia: false });

    expect(options.map((option) => option.id)).toEqual(BASE_IDS);
    expect(options.some((option) => option.id === "image")).toBe(false);
    expect(options.some((option) => option.id === "video")).toBe(false);
    expect(options.some((option) => option.group === "media")).toBe(false);
  });

  it("añade imagen y video al final cuando canUploadMedia es true", () => {
    const options = getOptions({ canUploadMedia: true });

    expect(options.map((option) => option.id)).toEqual([...BASE_IDS, "image", "video"]);
  });

  it("asigna cada opción al grupo esperado", () => {
    const options = getOptions({ canUploadMedia: true });

    const groups = Object.fromEntries(options.map((option) => [option.id, option.group]));
    expect(groups).toEqual(EXPECTED_GROUPS);
  });

  it("usa las keywords esperadas para imagen y video", () => {
    const options = getOptions({ canUploadMedia: true });

    expect(byId(options, "image").keywords).toEqual([
      "imagen",
      "foto",
      "image",
      "picture",
      "img",
      "upload",
    ]);
    expect(byId(options, "video").keywords).toEqual([
      "video",
      "mp4",
      "webm",
      "mov",
      "pelicula",
      "clip",
      "upload",
    ]);
  });

  it("cada opción trae label, description, icon y apply", () => {
    const options = getOptions({ canUploadMedia: true });

    for (const option of options) {
      expect(typeof option.label).toBe("string");
      expect(option.label.length).toBeGreaterThan(0);
      expect(typeof option.description).toBe("string");
      expect(option.icon).toBeTruthy();
      expect(typeof option.apply).toBe("function");
    }
  });

  it("apply de 'image' delega en onPickImage sin tocar el editor", () => {
    const onPickImage = vi.fn();
    const editor = {} as Editor;
    const options = getOptions({ canUploadMedia: true, onPickImage });

    byId(options, "image").apply(editor);

    expect(onPickImage).toHaveBeenCalledTimes(1);
  });

  it("apply de 'video' delega en onPickVideo sin tocar el editor", () => {
    const onPickVideo = vi.fn();
    const editor = {} as Editor;
    const options = getOptions({ canUploadMedia: true, onPickVideo });

    byId(options, "video").apply(editor);

    expect(onPickVideo).toHaveBeenCalledTimes(1);
  });

  it("apply de media no lanza cuando los callbacks no están definidos", () => {
    const options = getOptions({ canUploadMedia: true });
    const editor = {} as Editor;

    expect(() => byId(options, "image").apply(editor)).not.toThrow();
    expect(() => byId(options, "video").apply(editor)).not.toThrow();
  });

  it("memoiza la lista mientras no cambien las dependencias", () => {
    const onPickImage = vi.fn();
    const onPickVideo = vi.fn();
    const { result, rerender } = renderHook(
      (props: Config) => useBlockOptions(props),
      { initialProps: { canUploadMedia: true, onPickImage, onPickVideo } },
    );

    const first = result.current;
    rerender({ canUploadMedia: true, onPickImage, onPickVideo });

    expect(result.current).toBe(first);
  });

  it("recalcula la lista cuando cambia canUploadMedia", () => {
    const { result, rerender } = renderHook(
      (props: Config) => useBlockOptions(props),
      { initialProps: { canUploadMedia: false } },
    );

    expect(result.current.some((option) => option.id === "image")).toBe(false);

    rerender({ canUploadMedia: true });

    expect(result.current.some((option) => option.id === "image")).toBe(true);
  });
});
