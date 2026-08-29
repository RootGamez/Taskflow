import { Button, Input } from "@heroui/react";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";
import { useCreatePage, usePages } from "@/features/pages/hooks/usePages";
import { useDebounce } from "@/hooks/useDebounce";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Indice de paginas del workspace (docs/PHASE_4_PLAN.md seccion 4, WP-P):
 * busqueda `?q=` (D10, resuelta server-side sobre `title`/`content_text`)
 * con debounce, y un CTA para crear la primera pagina cuando el workspace
 * todavia no tiene ninguna.
 */
export default function PageIndexPage() {
  const { workspaceSlug = "" } = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  const { data: pages, isLoading } = usePages(workspaceSlug, debouncedQuery || undefined);
  const createPage = useCreatePage(workspaceSlug);

  async function handleCreate(): Promise<void> {
    const page = await createPage.mutateAsync({ title: "Página sin título" });
    navigate(`/workspaces/${workspaceSlug}/pages/${page.id}`);
  }

  const hasPages = (pages?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Páginas</h1>
        <Button color="primary" size="sm" onPress={handleCreate} isDisabled={createPage.isPending}>
          <Plus className="h-4 w-4" /> Nueva página
        </Button>
      </div>

      <Input
        aria-label="Buscar páginas"
        placeholder="Buscar por título o contenido..."
        value={query}
        onValueChange={setQuery}
      />

      {!isLoading && !hasPages ? (
        <EmptyState
          icon={FileText}
          title="Todavía no hay páginas"
          description={`La documentación de ${workspaceSlug || "este espacio"} va a vivir acá.`}
          action={{ label: "Crear página", onClick: handleCreate }}
        />
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {(pages ?? []).map((page) => (
            <li key={page.id}>
              <Link
                to={`/workspaces/${workspaceSlug}/pages/${page.id}`}
                className="flex items-center gap-2 py-3 text-sm text-zinc-700 hover:text-brand-700 dark:text-zinc-200"
              >
                {page.icon ? <span>{page.icon}</span> : <FileText className="h-4 w-4 text-zinc-400" />}
                <span className="font-medium">{page.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
