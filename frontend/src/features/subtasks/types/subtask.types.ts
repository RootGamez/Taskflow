import type { User } from "@/features/auth/types/auth.types";

export interface SubTask {
  id: string;
  ticket_id: string;
  title: string;
  is_done: boolean;
  order: number;
  // D33: se implementa y testea en la API, pero NO se expone en la UI de v1
  // (ningun selector de responsable en SubtaskComposer/SubtaskItem).
  assignee: User | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubtaskPayload {
  title: string;
  assignee_id?: string;
}

export interface UpdateSubtaskPayload {
  title?: string;
  is_done?: boolean;
  assignee_id?: string | null;
}
