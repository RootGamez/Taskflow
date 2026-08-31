/**
 * useTicketEditorUploads.ts
 *
 * Reune las tres funciones de subida del editor de un ticket (imagen,
 * video, documento) y el `attachmentScope` que los NodeView necesitan
 * para descargar.
 *
 * Existe porque `KanbanPage`, `ListPage` y `SprintBoardPage` repetian
 * literalmente los mismos dos `useCallback` cada una; anadir el tercero
 * habria significado nueve bloques identicos. Con esto, cada pagina hace
 * una llamada y reparte el resultado.
 */

import { useCallback, useMemo } from "react";

import {
  uploadTicketImage,
  uploadTicketVideo,
} from "@/features/tickets/api/ticketsApi";
import { uploadTicketAttachment } from "../api/attachmentsApi";
import type { EditorAttachmentScope } from "../context/EditorAttachmentContext";
import type { DocumentUploadFn, ImageUploadFn } from "../lib/uploads";

interface TicketEditorUploads {
  onUploadImage: ImageUploadFn;
  onUploadVideo: ImageUploadFn;
  onUploadDocument: DocumentUploadFn;
  attachmentScope: EditorAttachmentScope | null;
}

export function useTicketEditorUploads(
  projectId: string,
  ticketId: string | null,
): TicketEditorUploads {
  const onUploadImage = useCallback<ImageUploadFn>(
    async (file) => {
      if (!ticketId) throw new Error("No hay ticket seleccionado.");
      const { url } = await uploadTicketImage(projectId, ticketId, file);
      return url;
    },
    [projectId, ticketId],
  );

  const onUploadVideo = useCallback<ImageUploadFn>(
    async (file) => {
      if (!ticketId) throw new Error("No hay ticket seleccionado.");
      const { url } = await uploadTicketVideo(projectId, ticketId, file);
      return url;
    },
    [projectId, ticketId],
  );

  const onUploadDocument = useCallback<DocumentUploadFn>(
    async (file) => {
      if (!ticketId) throw new Error("No hay ticket seleccionado.");
      return uploadTicketAttachment(projectId, ticketId, file);
    },
    [projectId, ticketId],
  );

  const attachmentScope = useMemo<EditorAttachmentScope | null>(
    () => (projectId && ticketId ? { scope: "ticket", projectId, ticketId } : null),
    [projectId, ticketId],
  );

  return { onUploadImage, onUploadVideo, onUploadDocument, attachmentScope };
}
