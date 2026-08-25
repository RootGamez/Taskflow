import type { Activity } from "@/features/activities/types/activity.types";
import { apiClient } from "@/lib/axios";

export async function getTicketActivities(projectId: string, ticketId: string): Promise<Activity[]> {
  const { data } = await apiClient.get<Activity[]>(`/projects/${projectId}/tickets/${ticketId}/activities/`);
  return data;
}
