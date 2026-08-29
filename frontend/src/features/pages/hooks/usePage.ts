import { useQuery } from "@tanstack/react-query";

import { getPage } from "@/features/pages/api/pagesApi";
import { pageQueryKeys } from "@/features/pages/lib/pageQueryKeys";

export function usePage(workspaceSlug: string, pageId: string) {
  return useQuery({
    queryKey: pageQueryKeys.detail(workspaceSlug, pageId),
    queryFn: () => getPage(workspaceSlug, pageId),
    enabled: Boolean(workspaceSlug) && Boolean(pageId),
  });
}
