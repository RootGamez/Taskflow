import type { WorkspaceStatus } from "@/features/sprints/types/sprint.types";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { apiClient } from "@/lib/axios";

export interface SprintBoardData {
  statuses: WorkspaceStatus[];
  tickets: Ticket[];
}

/** `sprint`: un uuid de sprint, `"backlog"`, o `undefined` (todos). */
export async function getSprintBoard(
  workspaceSlug: string,
  sprint?: string,
): Promise<SprintBoardData> {
  const { data } = await apiClient.get<SprintBoardData>(`/workspaces/${workspaceSlug}/board/`, {
    params: sprint ? { sprint } : undefined,
  });
  return data;
}
