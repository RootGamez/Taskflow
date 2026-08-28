import type {
  TicketTemplate,
  TicketTemplateUpdatePayload,
  TicketTemplateWritePayload,
} from "@/features/ticket-templates/types/ticketTemplate.types";
import { apiClient } from "@/lib/axios";

export async function getTicketTemplatesByProject(projectId: string): Promise<TicketTemplate[]> {
  const { data } = await apiClient.get<TicketTemplate[]>(`/projects/${projectId}/ticket-templates/`);
  return data;
}

export async function createTicketTemplate(
  projectId: string,
  payload: TicketTemplateWritePayload,
): Promise<TicketTemplate> {
  const { data } = await apiClient.post<TicketTemplate>(`/projects/${projectId}/ticket-templates/`, payload);
  return data;
}

export async function updateTicketTemplate(
  projectId: string,
  templateId: string,
  payload: TicketTemplateUpdatePayload,
): Promise<TicketTemplate> {
  const { data } = await apiClient.patch<TicketTemplate>(
    `/projects/${projectId}/ticket-templates/${templateId}/`,
    payload,
  );
  return data;
}

export async function deleteTicketTemplate(projectId: string, templateId: string): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/ticket-templates/${templateId}/`);
}
