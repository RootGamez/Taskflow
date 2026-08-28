import { apiClient } from "@/lib/axios";
import type { SearchResult } from "@/features/search/types/search.types";

export interface SearchTicketsParams {
  q: string;
  workspaceSlug?: string;
  limit?: number;
}

/**
 * `GET /api/v1/search/tickets/`. `workspace`/`limit` solo se mandan cuando
 * estan presentes -- el backend ya degrada `q` corto y `limit` invalido
 * (D16 de docs/PHASE_3_PLAN.md), no hace falta duplicar esa validacion aca.
 */
export async function searchTickets({ q, workspaceSlug, limit }: SearchTicketsParams): Promise<SearchResult[]> {
  const { data } = await apiClient.get<SearchResult[]>("/search/tickets/", {
    params: {
      q,
      ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
      ...(limit ? { limit } : {}),
    },
  });
  return data;
}
