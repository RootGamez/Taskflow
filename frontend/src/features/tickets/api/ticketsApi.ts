import type { Ticket } from "@/features/tickets/types/ticket.types";
import { apiClient } from "@/lib/axios";

interface CreateTicketPayload {
  title: string;
  description?: string;
  progress_notes?: string;
  priority?: Ticket["priority"];
  due_date?: string | null;
  column_id?: string;
  order?: number;
}

interface UpdateTicketPayload {
  title?: string;
  description?: string;
  progress_notes?: string;
  priority?: Ticket["priority"];
  due_date?: string | null;
  column_id?: string;
  order?: number;
}

export interface UploadTicketImageResponse {
  url: string;
  id: string;
}

export interface UploadTicketVideoResponse {
  url: string;
  id: string;
}

export async function getTicketsByProject(projectId: string): Promise<Ticket[]> {
  const { data } = await apiClient.get<Ticket[]>(`/projects/${projectId}/tickets/`);
  return data;
}

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  const { data } = await apiClient.get<Ticket>(`/tickets/${ticketId}/`);
  return data;
}

export async function createTicket(projectId: string, payload: CreateTicketPayload): Promise<Ticket> {
  const { data } = await apiClient.post<Ticket>(`/projects/${projectId}/tickets/`, payload);
  return data;
}

export async function updateTicket(
  projectId: string,
  ticketId: string,
  payload: UpdateTicketPayload,
): Promise<Ticket> {
  const { data } = await apiClient.patch<Ticket>(
    `/projects/${projectId}/tickets/${ticketId}/`,
    payload,
  );
  return data;
}

/**
 * Sube una imagen al ticket y devuelve la URL pública de MinIO.
 * Úsala para insertar imágenes en el rich editor antes de serializar el JSON.
 */
export async function uploadTicketImage(
  projectId: string,
  ticketId: string,
  file: File,
): Promise<UploadTicketImageResponse> {
  const formData = new FormData();
  formData.append("image", file);

  const { data } = await apiClient.post<UploadTicketImageResponse>(
    `/projects/${projectId}/tickets/${ticketId}/images/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

/**
 * Sube un video al ticket y devuelve la URL pública de MinIO.
 */
export async function uploadTicketVideo(
  projectId: string,
  ticketId: string,
  file: File,
): Promise<UploadTicketVideoResponse> {
  const formData = new FormData();
  formData.append("video", file);

  const { data } = await apiClient.post<UploadTicketVideoResponse>(
    `/projects/${projectId}/tickets/${ticketId}/videos/`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}
