import type { MyTask } from "@/features/mytasks/types/myTask.types";
import { apiClient } from "@/lib/axios";

export async function getMyTasks(): Promise<MyTask[]> {
  const { data } = await apiClient.get<MyTask[]>("/tickets/mine/");
  return data;
}
