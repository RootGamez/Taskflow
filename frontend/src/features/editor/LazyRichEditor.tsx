"use client";

/**
 * LazyRichEditor.tsx
 *
 * Carga diferida del editor. Es el punto de entrada que deben usar las
 * pantallas; `RichEditor` directo solo tiene sentido en tests.
 *
 * Por que: el editor arrastra Tiptap, ProseMirror, lowlight con 10
 * gramaticas, KaTeX y el catalogo de emojis de GitHub. Estaticamente
 * importado, eso son ~1,5 MB que pagan TODAS las pantallas de la app --
 * incluidas el login y el tablero, donde no hay ningun editor. Diferido,
 * solo lo descarga quien abre un ticket o una pagina.
 *
 * El `fallback` reserva una altura parecida a la del editor vacio para
 * que la pantalla no salte cuando termina de cargar.
 */

import { Suspense, lazy } from "react";

import type { RichEditorProps } from "./RichEditor";

const RichEditor = lazy(() =>
  import("./RichEditor").then((module) => ({ default: module.RichEditor })),
);

function EditorSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2" aria-hidden="true">
      <div className="h-4 w-3/4 rounded bg-muted" />
      <div className="h-4 w-full rounded bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-4 w-5/6 rounded bg-muted" />
    </div>
  );
}

export function LazyRichEditor(props: RichEditorProps) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <RichEditor {...props} />
    </Suspense>
  );
}
