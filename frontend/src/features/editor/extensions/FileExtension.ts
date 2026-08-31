/**
 * FileExtension.ts
 *
 * Nodo `file`: un adjunto (PDF, Word, Excel, ZIP...) dentro del documento,
 * renderizado como tarjeta descargable por `FileNodeView`.
 *
 * Que se guarda en el JSON y que no:
 *
 * Se guarda `attachmentId`, NUNCA la URL. Los documentos viven en el bucket
 * privado y se sirven con URLs prefirmadas que caducan en 5 minutos (ver
 * `apps/attachments/storage.py`); una URL guardada en el contenido estaria
 * muerta al dia siguiente. El resto de atributos (`fileName`, `mimeType`,
 * `size`) se duplican en el nodo a proposito: permiten pintar la tarjeta
 * completa sin una peticion por adjunto al abrir el documento.
 *
 * Es un `atom` como `bookmark` y `video`: no tiene contenido editable
 * dentro. `TrailingNode` garantiza que siempre haya un parrafo despues.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { FileNodeView } from "../components/FileNodeView";

export interface FileAttributes {
  attachmentId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  /** Marca de subida en curso; el NodeView pinta el shimmer. */
  uploading: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileBlock: {
      insertFile: (attrs: Partial<FileAttributes>) => ReturnType;
    };
  }
}

export const FileExtension = Node.create({
  name: "file",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes) =>
          attributes.attachmentId ? { "data-attachment-id": attributes.attachmentId } : {},
      },
      fileName: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-file-name") ?? "",
        renderHTML: (attributes) => ({ "data-file-name": attributes.fileName ?? "" }),
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime-type") ?? "",
        renderHTML: (attributes) => ({ "data-mime-type": attributes.mimeType ?? "" }),
      },
      size: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute("data-size")) || 0,
        renderHTML: (attributes) => ({ "data-size": String(attributes.size ?? 0) }),
      },
      uploading: {
        default: false,
        // Estado efimero de UI: no se serializa al HTML ni sobrevive a una
        // recarga. Un nodo que quedo "subiendo" por un fallo de red vuelve
        // como tarjeta rota, que es informacion util, no como un shimmer
        // eterno.
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "file" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileNodeView);
  },

  addCommands() {
    return {
      insertFile:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
