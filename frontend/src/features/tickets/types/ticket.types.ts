import type { User } from "@/features/auth/types/auth.types";

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

export interface Label {
  id: string;
  project_id: string;
  name: string;
  color: string;
}

export interface Ticket {
  id: string;
  project_id: string;
  column_id: string;
  created_by: string | null;
  title: string;
  description: Record<string, unknown> | null;
  priority: Priority;
  order: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignees: User[];
  labels: Label[];
}
