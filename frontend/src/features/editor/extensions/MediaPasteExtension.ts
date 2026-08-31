/**
 * MediaPasteExtension.ts
 *
 * Sube imagenes y videos pegados o soltados sobre el editor. Extraido de
 * `RichEditor.tsx` (Fase 1), donde vivia como un `Extension.create` inline
 * de ~60 lineas dentro de la lista de extensiones.
 *
 * Los callbacks llegan por getter y no por valor: la extension se construye
 * una sola vez al montar el editor, asi que capturar `onUploadImage` por
 * valor congelaria la primera version de la prop. `RichEditor` pasa getters
 * que leen de un ref.
 *
 * Cubre imagenes, videos y documentos (PDF, Word, Excel...). Se mantiene
 * como plugin propio en vez de `@tiptap/extension-file-handler` porque
 * necesita enrutar por tipo a tres uploaders distintos y, para los
 * convertibles, insertar contenido ADEMAS de adjuntar el original --
 * logica que el handler oficial no expone.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import {
  handleDocumentUpload,
  handleImageUpload,
  handleVideoUpload,
  isImageFile,
  isVideoFile,
  type DocumentUploadFn,
  type ImageUploadFn,
} from "../lib/uploads";
import { isDocumentFile } from "../lib/fileTypes";

export interface MediaPasteOptions {
  getImageUploader: () => ImageUploadFn | undefined;
  getVideoUploader: () => ImageUploadFn | undefined;
  getDocumentUploader: () => DocumentUploadFn | undefined;
}

const PLUGIN_KEY = new PluginKey("mediaUpload");

export const MediaPasteExtension = Extension.create<MediaPasteOptions>({
  name: "mediaUpload",

  addOptions() {
    return {
      getImageUploader: () => undefined,
      getVideoUploader: () => undefined,
      getDocumentUploader: () => undefined,
    };
  },

  addProseMirrorPlugins() {
    const { getImageUploader, getVideoUploader, getDocumentUploader } = this.options;

    /** Enruta un archivo al uploader que le toca. `false` si no hay. */
    const uploadFile = (
      view: Parameters<typeof handleImageUpload>[0],
      file: File,
      pos?: number,
    ): boolean => {
      if (isImageFile(file)) {
        const upload = getImageUploader();
        if (!upload) return false;
        handleImageUpload(view, file, upload, pos);
        return true;
      }
      if (isVideoFile(file)) {
        const upload = getVideoUploader();
        if (!upload) return false;
        handleVideoUpload(view, file, upload, pos);
        return true;
      }
      if (isDocumentFile(file)) {
        const upload = getDocumentUploader();
        if (!upload) return false;
        handleDocumentUpload(view, file, upload, pos);
        return true;
      }
      return false;
    };

    return [
      new Plugin({
        key: PLUGIN_KEY,
        props: {
          handlePaste(view, event) {
            const files = Array.from((event as ClipboardEvent).clipboardData?.items ?? [])
              .filter((item) => item.kind === "file")
              .map((item) => item.getAsFile())
              .filter(
                (file): file is File =>
                  file !== null &&
                  (isImageFile(file) || isVideoFile(file) || isDocumentFile(file)),
              );

            if (files.length === 0) return false;

            // Solo se previene el pegado por defecto si al menos un archivo
            // tiene uploader: sin esto, pegar una imagen en un editor de
            // solo lectura tragaba el evento y no pasaba nada.
            const handled = files.map((file) => uploadFile(view, file)).some(Boolean);
            if (handled) event.preventDefault();
            return handled;
          },

          handleDrop(view, event, _slice, moved) {
            if (moved) return false;

            const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter(
              (file) => isImageFile(file) || isVideoFile(file) || isDocumentFile(file),
            );
            if (files.length === 0) return false;

            const dropPos = view.posAtCoords({
              left: (event as DragEvent).clientX,
              top: (event as DragEvent).clientY,
            });

            const handled = files
              .map((file) => uploadFile(view, file, dropPos?.pos))
              .some(Boolean);
            if (handled) event.preventDefault();
            return handled;
          },
        },
      }),
    ];
  },
});
