import type {
  CreateGoalItemPayload,
  UpdateGoalItemPayload,
  WeeklyBoard,
  WeeklyGoalItem,
} from "@/features/goals/types/goals.types";
import { apiClient } from "@/lib/axios";

const boardUrl = (workspaceSlug: string) => `/workspaces/${workspaceSlug}/weekly-board/`;
const itemsUrl = (workspaceSlug: string) => `${boardUrl(workspaceSlug)}items/`;
const itemUrl = (workspaceSlug: string, itemId: string) =>
  `${itemsUrl(workspaceSlug)}${itemId}/`;

/**
 * Pizarra de metas de la semana ISO actual. El backend hace `get_or_create`:
 * nunca 404, el board siempre existe (RD-3).
 */
export async function getWeeklyBoard(workspaceSlug: string): Promise<WeeklyBoard> {
  const { data } = await apiClient.get<WeeklyBoard>(boardUrl(workspaceSlug));
  return data;
}

export async function createGoalItem(
  workspaceSlug: string,
  payload: CreateGoalItemPayload,
): Promise<WeeklyGoalItem> {
  const { data } = await apiClient.post<WeeklyGoalItem>(itemsUrl(workspaceSlug), payload);
  return data;
}

export async function updateGoalItem(
  workspaceSlug: string,
  itemId: string,
  payload: UpdateGoalItemPayload,
): Promise<WeeklyGoalItem> {
  const { data } = await apiClient.patch<WeeklyGoalItem>(itemUrl(workspaceSlug, itemId), payload);
  return data;
}

export async function deleteGoalItem(workspaceSlug: string, itemId: string): Promise<void> {
  await apiClient.delete(itemUrl(workspaceSlug, itemId));
}
