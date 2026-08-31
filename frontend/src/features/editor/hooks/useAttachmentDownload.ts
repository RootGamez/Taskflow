/**
 * useAttachmentDownload.ts
 *
 * Da al `FileNodeView` una funcion de descarga sin que el nodo tenga que
 * saber en que superficie vive. El editor se monta con un contexto que
 * trae los ids (ticket/proyecto o workspace/pagina); si no hay contexto
 * -- por ejemplo en un test que renderiza el NodeView aislado -- la
 * descarga avisa en vez de romper.
 */

import { useCallback, useContext } from "react";

import {
  buildPageAttachmentDownloadUrl,
  buildTicketAttachmentDownloadUrl,
  downloadAttachment,
} from "../api/attachmentsApi";
import { EditorAttachmentContext } from "../context/EditorAttachmentContext";

export type AttachmentDownloadFn = (attachmentId: string, fileName: string) => Promise<void>;

export function useAttachmentDownload(): AttachmentDownloadFn {
  const context = useContext(EditorAttachmentContext);

  return useCallback(
    async (attachmentId: string, fileName: string) => {
      if (!context) {
        const { default: toast } = await import("react-hot-toast");
        toast.error("La descarga no está disponible aquí.");
        return;
      }

      const endpoint =
        context.scope === "ticket"
          ? buildTicketAttachmentDownloadUrl(context.projectId, context.ticketId, attachmentId)
          : buildPageAttachmentDownloadUrl(context.workspaceSlug, context.pageId, attachmentId);

      try {
        await downloadAttachment(endpoint, fileName);
      } catch {
        const { default: toast } = await import("react-hot-toast");
        toast.error("No se pudo descargar el archivo.");
      }
    },
    [context],
  );
}
