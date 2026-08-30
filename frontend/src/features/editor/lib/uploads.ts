/**
 * uploads.ts
 *
 * Validación y subida optimista de media dentro del editor. Extraído de
 * `RichEditor.tsx` (Fase 1 del repotenciado): la subida no es "UI del
 * editor", es una operación sobre el documento de ProseMirror, y tenerla
 * aparte permite testearla sin montar React.
 *
 * Patrón optimista: se inserta un nodo con un `URL.createObjectURL` local y
 * `title: "__uploading__"` (que los NodeView usan para pintar el shimmer);
 * al resolver la subida se reemplaza el `src` por la URL pública y al
 * fallar se borra el nodo. En ambos casos se revoca el object URL.
 */

import type { Editor } from "@tiptap/react";

/** Sube un `File` y resuelve con la URL pública. */
export type ImageUploadFn = (file: File) => Promise<string>;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
export const MAX_IMAGE_SIZE_MB = 10;

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/ogg",
];
export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv"];
export const MAX_VIDEO_SIZE_MB = 200;

/** Marca de nodo en subida — la leen ImageNodeView y VideoNodeView. */
export const UPLOADING_MARKER = "__uploading__";

export function isImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

export function isVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_TYPES.includes(file.type);
}

/** Devuelve el mensaje de error, o `null` si el archivo es válido. */
export function validateImageFile(file: File): string | null {
  if (!isImageFile(file)) {
    return `Formato no soportado. Usa: ${ALLOWED_IMAGE_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `La imagen supera el límite de ${MAX_IMAGE_SIZE_MB} MB.`;
  }
  return null;
}

/** Devuelve el mensaje de error, o `null` si el archivo es válido. */
export function validateVideoFile(file: File): string | null {
  if (!isVideoFile(file)) {
    return `Formato no soportado. Usa: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    return `El video supera el límite de ${MAX_VIDEO_SIZE_MB} MB.`;
  }
  return null;
}

interface MediaUploadConfig {
  /** Nombre del nodo de ProseMirror ("image" | "video"). */
  nodeName: "image" | "video";
  /** Atributos extra del nodo de vista previa. */
  previewAttrs?: Record<string, unknown>;
  /** Mensaje de toast si la subida falla. */
  errorMessage: string;
}

/**
 * Inserta un nodo optimista, lanza la subida y reconcilia el resultado.
 * Compartido por imagen y video — la única diferencia real entre ambos era
 * el nombre del nodo y el texto del error.
 */
function uploadMedia(
  view: Editor["view"],
  file: File,
  uploadFn: ImageUploadFn,
  config: MediaUploadConfig,
  insertAtPos?: number,
): void {
  const { state } = view;
  const nodeType = state.schema.nodes[config.nodeName];
  if (!nodeType) return;

  const objectUrl = URL.createObjectURL(file);
  const previewNode = nodeType.create({
    src: objectUrl,
    title: UPLOADING_MARKER,
    ...config.previewAttrs,
  });

  const { tr } = state;
  const pos = insertAtPos ?? state.selection.to;
  tr.insert(pos, previewNode);
  view.dispatch(tr);

  /** Recorre el doc buscando el nodo optimista y le aplica `mutate`. */
  const withPreviewNode = (mutate: (nodePos: number, nodeSize: number, attrs: Record<string, unknown>) => void) => {
    view.state.doc.descendants((node, nodePos) => {
      if (node.type.name === config.nodeName && node.attrs.src === objectUrl) {
        mutate(nodePos, node.nodeSize, node.attrs as Record<string, unknown>);
      }
    });
    URL.revokeObjectURL(objectUrl);
  };

  uploadFn(file)
    .then((publicUrl) => {
      withPreviewNode((nodePos, _size, attrs) => {
        view.dispatch(
          view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...attrs,
            src: publicUrl,
            title: undefined,
          }),
        );
      });
    })
    .catch(async () => {
      withPreviewNode((nodePos, nodeSize) => {
        view.dispatch(view.state.tr.delete(nodePos, nodePos + nodeSize));
      });
      const { default: toast } = await import("react-hot-toast");
      toast.error(config.errorMessage);
    });
}

export function handleImageUpload(
  view: Editor["view"],
  file: File,
  uploadFn: ImageUploadFn,
  insertAtPos?: number,
): void {
  uploadMedia(
    view,
    file,
    uploadFn,
    {
      nodeName: "image",
      previewAttrs: { alt: file.name },
      errorMessage: "No se pudo subir la imagen.",
    },
    insertAtPos,
  );
}

export function handleVideoUpload(
  view: Editor["view"],
  file: File,
  uploadFn: ImageUploadFn,
  insertAtPos?: number,
): void {
  uploadMedia(
    view,
    file,
    uploadFn,
    { nodeName: "video", errorMessage: "No se pudo subir el video." },
    insertAtPos,
  );
}
