import { useQuery } from "@tanstack/react-query";

import { searchTickets } from "@/features/search/api/searchApi";
import { searchQueryKeys } from "@/features/search/lib/searchQueryKeys";
import type { SearchResult } from "@/features/search/types/search.types";
import { useDebounce } from "@/hooks/useDebounce";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

interface UseGlobalSearchResult {
  results: SearchResult[];
  isLoading: boolean;
  isError: boolean;
}

/**
 * Hook consumido por el command palette (D22 de docs/PHASE_3_PLAN.md):
 * debounce de 250ms con el `useDebounce` ya existente (nada nuevo) +
 * `enabled: query.length >= 2`, calcado sobre el `q` corto de D16 del
 * backend para no disparar una request por cada tecla de una query corta.
 */
export function useGlobalSearch(query: string, workspaceSlug?: string): UseGlobalSearchResult {
  const debouncedQuery = useDebounce(query.trim(), SEARCH_DEBOUNCE_MS);
  const isQueryLongEnough = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const { data, isLoading, isError } = useQuery<SearchResult[]>({
    queryKey: searchQueryKeys.list(debouncedQuery, workspaceSlug),
    queryFn: () => searchTickets({ q: debouncedQuery, workspaceSlug }),
    enabled: isQueryLongEnough,
  });

  return {
    results: data ?? [],
    isLoading: isQueryLongEnough && isLoading,
    isError,
  };
}
