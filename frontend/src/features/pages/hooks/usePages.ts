import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createPage, deletePage, getPages, updatePage } from "@/features/pages/api/pagesApi";
import { pageQueryKeys } from "@/features/pages/lib/pageQueryKeys";
import type { CreatePagePayload, UpdatePagePayload } from "@/features/pages/types/page.types";

export function usePages(workspaceSlug: string, q?: string, project?: string) {
  return useQuery({
    queryKey: pageQueryKeys.list(workspaceSlug, q, project),
    queryFn: () => getPages(workspaceSlug, { q, project }),
    enabled: Boolean(workspaceSlug),
  });
}

export function useCreatePage(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreatePagePayload) => createPage(workspaceSlug, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageQueryKeys.allLists(workspaceSlug) });
    },
  });
}

export function useUpdatePage(workspaceSlug: string, pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdatePagePayload) => updatePage(workspaceSlug, pageId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageQueryKeys.allLists(workspaceSlug) });
      void queryClient.invalidateQueries({ queryKey: pageQueryKeys.detail(workspaceSlug, pageId) });
    },
  });
}

/**
 * D17: borrar una pagina borra su subarbol completo. Tras el 204, ya no
 * hay nada que mostrar en `/pages/:pageId` -- el hook navega de vuelta al
 * indice del workspace en vez de dejar al usuario mirando una pagina
 * fantasma (test 57, docs/PHASE_4_PLAN.md seccion 4.5).
 */
export function useDeletePage(workspaceSlug: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (pageId: string) => deletePage(workspaceSlug, pageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageQueryKeys.allLists(workspaceSlug) });
      navigate(`/workspaces/${workspaceSlug}/pages`);
    },
  });
}
