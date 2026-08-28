/**
 * Guarda de "target editable" -- D49 de docs/PHASE_3_PLAN.md (RD1, riesgo
 * #1 de toda la feature, severidad CRITICA).
 *
 * Vive en su propio archivo puro, con sus propios tests, y NO inline en el
 * listener de teclado: sin esto, escribir la palabra "crear" en el editor
 * Tiptap del detalle de un ticket dispara el atajo `c` y abre el modal de
 * creacion encima.
 *
 * El editor Tiptap (`TicketRichEditor.tsx`, via ProseMirror/`EditorContent`)
 * usa `[contenteditable="true"]`, NO `<textarea>` -- y el `target` real de
 * un keydown mientras se escribe casi siempre es un nodo HIJO del
 * contenteditable (un parrafo, un span), nunca el div raiz. Por eso la
 * guarda sube el DOM con `closest('[contenteditable="true"]')` en vez de
 * mirar unicamente `target.tagName`.
 */
const TYPING_TAG_NAMES = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (TYPING_TAG_NAMES.has(target.tagName)) {
    return true;
  }

  return target.closest('[contenteditable="true"]') !== null;
}
