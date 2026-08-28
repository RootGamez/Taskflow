import type { Priority } from "@/features/tickets/types/ticket.types";

/**
 * Contrato de `GET /api/v1/search/tickets/` (WP-A, Fase 3, D17).
 *
 * Deliberadamente lean: NO es un `Ticket` recortado ni reusa
 * `ticket.types.ts` mas alla del tipo `Priority` (union de solo lectura,
 * sin acoplar este feature al resto de la forma de `Ticket`). Espeja
 * 1:1 `SearchResultSerializer` del backend
 * (`backend/apps/tickets/search.py`).
 */
export interface SearchResultProject {
  id: string;
  name: string;
  key: string | null;
  color: string;
  workspace_slug: string;
}

export interface SearchResult {
  id: string;
  title: string;
  reference: string | null;
  priority: Priority;
  due_date: string | null;
  column_name: string;
  project: SearchResultProject;
}
