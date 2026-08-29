export type SprintStatus = "planned" | "active" | "completed";

export interface Sprint {
  id: string;
  workspace_id: string;
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
  | { kind: "current" }
  | { kind: "backlog" }
  | { kind: "sprint"; sprintId: string };

/** Estado (columna) compartido a nivel espacio. El tablero de sprint agrupa
 * los tickets de todos los proyectos por estos estados. */
export interface WorkspaceStatus {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  order: number;
  is_done: boolean;
  /** Los 3 por defecto (Backlog / En progreso / Completado): no se pueden
   * renombrar ni eliminar. */
  is_system: boolean;
  created_at: string;
}
