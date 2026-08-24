export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string;
  created_at: string;
  role: "owner" | "admin" | "member" | "viewer";
  is_active: boolean;
}
