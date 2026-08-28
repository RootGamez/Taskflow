import { apiClient } from "@/lib/axios";
import type { CreateRelationPayload, TicketRelation } from "@/features/relations/types/relation.types";

export async function getTicketRelations(projectId: string, ticketId: string): Promise<TicketRelation[]> {
  const { data } = await apiClient.get<TicketRelation[]>(
    `/projects/${projectId}/tickets/${ticketId}/relations/`,
  );
  return data;
}

export async function createTicketRelation(
  projectId: string,
  ticketId: string,
  payload: CreateRelationPayload,
): Promise<TicketRelation> {
  const { data } = await apiClient.post<TicketRelation>(
    `/projects/${projectId}/tickets/${ticketId}/relations/`,
    payload,
  );
  return data;
}

export async function deleteTicketRelation(
  projectId: string,
  ticketId: string,
  relationId: string,
): Promise<void> {
  await apiClient.delete(`/projects/${projectId}/tickets/${ticketId}/relations/${relationId}/`);
}
