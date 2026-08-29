export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  key: string | null;
  description: string | null;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  columns: Column[];
}

export interface Column {
  id: string;
  project_id: string;
  /** Estado del espacio al que mapea esta columna (tablero de sprint).
   * `null` si aún no está mapeada. Opcional: fixtures de tests previos no lo
   * setean; el backend siempre lo manda. */
  workspace_status_id?: string | null;
  name: string;
  color: string;
  order: number;
}
