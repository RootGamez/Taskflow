/**
 * EditorAttachmentContext.ts
 *
 * Identifica el documento al que pertenece el editor, para que los
 * NodeView de adjunto sepan a que endpoint pedir la descarga.
 *
 * Va por contexto y no por props porque los NodeView de Tiptap se montan
 * a traves de `ReactNodeViewRenderer`, fuera del arbol de props del
 * componente: no hay forma de pasarles nada desde `RichEditor` salvo
 * un contexto de React (o `editor.storage`, que no reacciona a cambios).
 *
 * `null` es un estado valido: el editor puede montarse sin adjuntos
 * (un ticket recien creado sin id todavia, o un test aislado).
 */

import { createContext } from "react";

export type EditorAttachmentScope =
  | { scope: "ticket"; projectId: string; ticketId: string }
  | { scope: "page"; workspaceSlug: string; pageId: string };

export const EditorAttachmentContext = createContext<EditorAttachmentScope | null>(null);
