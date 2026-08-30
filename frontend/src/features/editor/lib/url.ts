/**
 * Utilidades de URL para el editor: normalización y saneado.
 *
 * Motivación:
 * - `BookmarkExtension` hacía `new URL(url)` sin `try/catch` → un `TypeError`
 *   reventaba el render del NodeView si el usuario escribía `google.com` sin
 *   esquema.
 * - `window.open(href)` sin validar el esquema → una URL `javascript:` o
 *   `data:` guardada en el JSON de un ticket es XSS almacenado.
 */

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Devuelve una URL `http(s)` absoluta y saneada, o `null` si no se puede
 * construir una segura. Antepone `https://` cuando falta el esquema.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Rechaza de entrada esquemas peligrosos escritos explícitamente.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    const scheme = trimmed.slice(0, trimmed.indexOf(":") + 1).toLowerCase();
    if (!SAFE_PROTOCOLS.has(scheme)) return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Hostname de una URL, o cadena vacía. Nunca lanza. */
export function safeHostname(raw: string | null | undefined): string {
  const normalized = normalizeUrl(raw);
  if (!normalized) return "";
  try {
    return new URL(normalized).hostname;
  } catch {
    return "";
  }
}

/** `true` si el texto es exactamente una URL (para convertir un pegado en bookmark). */
export function isBareUrlLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  return normalizeUrl(trimmed) !== null;
}
