export interface GoalCompletedBy {
  id: string;
  full_name: string;
  email: string;
}

export interface WeeklyGoalItem {
  id: string;
  text: string;
  is_done: boolean;
  order: number;
  completed_by: GoalCompletedBy | null;
  completed_at: string | null;
  created_at: string;
}

export interface WeeklyBoard {
  id: string;
  /** Lunes ISO de la semana (YYYY-MM-DD). */
  week_start: string;
  items: WeeklyGoalItem[];
  /** true si el usuario actual es OWNER/ADMIN del espacio (RD-1). */
  can_manage: boolean;
  created_at: string;
}

export interface CreateGoalItemPayload {
  text: string;
}

export interface UpdateGoalItemPayload {
  text?: string;
  is_done?: boolean;
  order?: number;
}
