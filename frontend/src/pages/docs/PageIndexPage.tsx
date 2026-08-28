import { FileText } from "lucide-react";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Stub de WP-0A (docs/PHASE_4_PLAN.md seccion 3, D3/D9): componente de
 * ruta real (no `null` -- a diferencia de los stubs de componente, una
 * pagina de ruta necesita renderizar algo), montado en `/workspaces/
 * :workspaceSlug/pages`. WP-P (Ola 1) reemplaza el cuerpo por el indice
 * real (listado + busqueda `?q=`), sin volver a tocar `router.tsx`.
 */
export default function PageIndexPage() {
  const { workspaceSlug = "" } = useParams();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Páginas</h1>
      <EmptyState
        icon={FileText}
        title="Todavía no hay páginas"
        description={`La documentación de ${workspaceSlug || "este espacio"} va a vivir acá.`}
      />
    </div>
  );
}
