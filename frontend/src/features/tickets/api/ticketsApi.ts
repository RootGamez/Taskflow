import type { Ticket } from "@/features/tickets/types/ticket.types";
import { apiClient } from "@/lib/axios";

interface CreateTicketPayload {
  title: string;
  priority?: Ticket["priority"];
  due_date?: string | null;
  column_id?: string;
  order?: number;
}

interface UpdateTicketPayload {
  title?: string;
  priority?: Ticket["priority"];
  due_date?: string | null;
  column_id?: string;
  order?: number;
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
