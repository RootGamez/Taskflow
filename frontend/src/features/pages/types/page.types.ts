export interface PageAuthor {
  id: string;
  full_name: string;
}

export interface PageBreadcrumbEntry {
  id: string;
  title: string;
  icon: string;
}

/**
 * Forma del listado (D11 de docs/PHASE_4_PLAN.md): nunca trae `content`.
 * `order`/`created_at` viajan igual (ver comentario en
 * `apps/pages/serializers.py::PageSummarySerializer`): `buildPageTree`
 * los necesita para ordenar hermanos sin pedir el detalle de cada nodo.
 */
export interface PageSummary {
  id: string;
  parent_id: string | null;
  project_id: string | null;
  title: string;
  icon: string;
  order: number;
  child_count: number;
  created_at: string;
  updated_at: string;
  updated_by: PageAuthor | null;
}

/** `PageSummary` + `content` + `breadcrumb` (solo en el detalle). */
export interface PageDetail extends PageSummary {
  content: string;
  created_by: PageAuthor | null;
  breadcrumb: PageBreadcrumbEntry[];
}

export interface CreatePagePayload {
  title: string;
  parent_id?: string | null;
  project_id?: string | null;
  icon?: string;
  content?: string;
}

export interface UpdatePagePayload {
  title?: string;
  parent_id?: string | null;
  project_id?: string | null;
  icon?: string;
  content?: string;
  /** D14: concurrencia optimista. Solo se manda cuando el PATCH trae `content`. */
  expected_updated_at?: string;
}
