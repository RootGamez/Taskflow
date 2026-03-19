export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  is_archived: boolean;
  created_at: string;
}

export interface Column {
  id: string;
  project_id: string;
  name: string;
  color: string;
  order: number;
}
