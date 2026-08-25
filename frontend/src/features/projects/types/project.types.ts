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
  name: string;
  color: string;
  order: number;
}
