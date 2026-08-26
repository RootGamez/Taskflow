export type SprintStatus = "planned" | "active" | "completed";

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  ticket_count: number;
  completed_ticket_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Union discriminada (D18) en vez de `string | null`: `null` seria ambiguo
 * entre "backlog" (tickets sin sprint) y "sin seleccion". No persistido,
 * se resetea por `projectId` (D6).
 */
export type SprintScope =
  | { kind: "all" }
  | { kind: "backlog" }
  | { kind: "sprint"; sprintId: string };
