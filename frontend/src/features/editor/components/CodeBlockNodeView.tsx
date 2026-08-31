"use client";

/**
 * CodeBlockNodeView.tsx
 *
 * Cabecera de los bloques de codigo: selector de lenguaje y boton de
 * copiar.
 *
 * `SUPPORTED_CODE_LANGUAGES` existia desde que se monto `CodeBlockLowlight`
 * pero no habia ninguna UI que lo usara: el lenguaje solo se podia cambiar
 * escribiendo ```ts al abrir el bloque, y quien no supiera ese atajo se
 * quedaba con `plaintext` sin resaltado.
 *
 * El contenido del bloque va en `NodeViewContent` como `<code>` dentro de
 * `<pre>`: lowlight escribe ahi sus `<span class="hljs-*">`, asi que la
 * estructura tiene que respetarse o se pierde el resaltado.
 */

import { useCallback, useState } from "react";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";
import { SUPPORTED_CODE_LANGUAGES } from "../extensions/createEditorExtensions";

/** Cuanto se mantiene el tick de "copiado" antes de volver al icono. */
const COPIED_FEEDBACK_MS = 1600;

export function CodeBlockNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs.language as string | null) ?? "plaintext";
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setHasCopied(true);
      window.setTimeout(() => setHasCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer, y no merece un
      // toast: el usuario siempre puede seleccionar y copiar a mano.
    }
  }, [node.textContent]);

  return (
    <NodeViewWrapper className="tf-code-block relative">
      <div
        contentEditable={false}
        className="flex items-center justify-between gap-2 rounded-t border-2 border-b-0 border-border bg-muted px-2 py-1"
      >
        {editor.isEditable ? (
          <select
            aria-label="Lenguaje del bloque de código"
            value={language}
            onChange={(event) => updateAttributes({ language: event.target.value })}
            className="h-6 cursor-pointer rounded border border-border bg-card px-1 text-xs text-foreground outline-none focus:border-primary"
          >
            {SUPPORTED_CODE_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">
            {SUPPORTED_CODE_LANGUAGES.find((o) => o.value === language)?.label ?? language}
          </span>
        )}

        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label="Copiar código"
          title="Copiar código"
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition",
            hasCopied
              ? "text-success"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {hasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {hasCopied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {/* `as="code"` es valido en runtime pero los tipos de v3 solo declaran
          "div"; el cast mantiene la estructura <pre><code> que lowlight
          necesita para escribir sus spans de resaltado. */}
      <pre className="!mt-0 !rounded-t-none">
        <NodeViewContent as={"code" as "div"} />
      </pre>
    </NodeViewWrapper>
  );
}
