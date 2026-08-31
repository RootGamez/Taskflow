/**
 * attachmentsApi.ts
 *
 * Cliente de los endpoints de `apps.attachments` (Fase 2 del repotenciado).
 *
 * Dos superficies con el mismo contrato -- tickets y paginas de
 * documentacion. El editor no sabe en cual esta montado: recibe una
 * `AttachmentUploadFn` ya cerrada sobre los ids, igual que hoy recibe
 * `onUploadImage`.
 *
 * El backend NO devuelve ninguna URL del archivo: los documentos viven en
 * un bucket privado y se sirven en streaming desde el endpoint de detalle
 * del adjunto, que exige autenticacion. El nodo `file` guarda el `id` y
 * construye la ruta con el.
 */

import { apiClient } from "@/lib/axios";

export interface Attachment {
  id: string;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum: string;
  uploaded_by_name: string;
  created_at: string;
}

/** Sube un archivo y resuelve con el adjunto ya persistido. */
export type AttachmentUploadFn = (file: File) => Promise<Attachment>;

const UPLOAD_FIELD = "file";

function toFormData(file: File): FormData {
  const formData = new FormData();
  formData.append(UPLOAD_FIELD, file);
  return formData;
}

export async function uploadTicketAttachment(
  projectId: string,
  ticketId: string,
  file: File,
): Promise<Attachment> {
  const { data } = await apiClient.post<Attachment>(
    `/projects/${projectId}/tickets/${ticketId}/attachments/`,
    toFormData(file),
  );
  return data;
}

export async function uploadPageAttachment(
  workspaceSlug: string,
  pageId: string,
  file: File,
): Promise<Attachment> {
  const { data } = await apiClient.post<Attachment>(
    `/workspaces/${workspaceSlug}/pages/${pageId}/attachments/`,
    toFormData(file),
  );
  return data;
}

/**
 * Ruta de descarga de un adjunto en la API. Estable: el backend sirve el
 * archivo en streaming desde el bucket privado, sin redirigir a MinIO.
 */
export function buildTicketAttachmentDownloadUrl(
  projectId: string,
  ticketId: string,
  attachmentId: string,
): string {
  return `/projects/${projectId}/tickets/${ticketId}/attachments/${attachmentId}/`;
}

export function buildPageAttachmentDownloadUrl(
  workspaceSlug: string,
  pageId: string,
  attachmentId: string,
): string {
  return `/workspaces/${workspaceSlug}/pages/${pageId}/attachments/${attachmentId}/`;
}

/**
 * Descarga un adjunto. Va por `apiClient` (y no por un `<a href>`) porque
 * el endpoint exige el header `Authorization`: un enlace normal lo
 * mandaria sin token y devolveria 401.
 *
 * El `Content-Type` real lo pone el backend; aqui se respeta el del blob
 * para que el navegador abra el archivo con la aplicacion correcta.
 */
export async function downloadAttachment(endpointUrl: string, fileName: string): Promise<void> {
  const { data } = await apiClient.get<Blob>(endpointUrl, { responseType: "blob" });

  const objectUrl = URL.createObjectURL(data);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
