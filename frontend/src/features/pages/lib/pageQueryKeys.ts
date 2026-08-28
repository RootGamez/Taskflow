/**
 * `allLists`/`detail` son prefijos: invalidar `allLists(workspaceSlug)`
 * matchea cualquier variante de `list(...)` de ese workspace (TanStack
 * Query hace matching por prefijo con `exact: false` por default) --
 * patron ya usado en `features/search/lib/searchQueryKeys.ts`.
 */
export const pageQueryKeys = {
  allLists: (workspaceSlug: string) => ["pages", workspaceSlug, "list"] as const,
  list: (workspaceSlug: string, q?: string, project?: string) =>
    ["pages", workspaceSlug, "list", q ?? "", project ?? ""] as const,
  detail: (workspaceSlug: string, pageId: string) => ["pages", workspaceSlug, "detail", pageId] as const,
};
