import { describe, expect, it } from "vitest";

import { isBareUrlLine, normalizeUrl, safeHostname } from "../url";

describe("normalizeUrl", () => {
  it("antepone https:// cuando falta el esquema", () => {
    expect(normalizeUrl("google.com")).toBe("https://google.com/");
    expect(normalizeUrl("  example.org/path?q=1 ")).toBe("https://example.org/path?q=1");
  });

  it("conserva http y https explícitos", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeUrl("https://example.com/x")).toBe("https://example.com/x");
  });

  it("rechaza esquemas peligrosos (XSS almacenado)", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("JavaScript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,<script>")).toBeNull();
    expect(normalizeUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rechaza esquemas no web", () => {
    expect(normalizeUrl("ftp://host/x")).toBeNull();
    expect(normalizeUrl("mailto:a@b.com")).toBeNull();
  });

  it("rechaza entradas vacías o sin host válido", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull(); // sin punto → no es un host público
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("safeHostname", () => {
  it("devuelve el hostname de una URL válida", () => {
    expect(safeHostname("https://sub.example.com/path")).toBe("sub.example.com");
    expect(safeHostname("example.com")).toBe("example.com");
  });

  it("nunca lanza; devuelve cadena vacía en entradas inválidas", () => {
    expect(safeHostname("javascript:alert(1)")).toBe("");
    expect(safeHostname("")).toBe("");
    expect(safeHostname(undefined)).toBe("");
  });
});

describe("isBareUrlLine", () => {
  it("acepta una URL sola", () => {
    expect(isBareUrlLine("https://example.com")).toBe(true);
    expect(isBareUrlLine("  example.com/x  ")).toBe(true);
  });

  it("rechaza texto con espacios o no-URL", () => {
    expect(isBareUrlLine("mira esto https://example.com")).toBe(false);
    expect(isBareUrlLine("hola mundo")).toBe(false);
    expect(isBareUrlLine("javascript:alert(1)")).toBe(false);
  });
});
