import { FileText } from "lucide-react";
import { useParams } from "react-router-dom";

import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Stub de WP-0A (docs/PHASE_4_PLAN.md seccion 3, D3/D9): componente de
 * ruta real (no `null`), montado en `/workspaces/:workspaceSlug/pages/
 * :pageId`. WP-P (Ola 1) reemplaza el cuerpo por el editor real (titulo +
 * emoji + breadcrumb + `TicketRichEditor`, D18), sin volver a tocar
 * `router.tsx`.
 */
export default function PageDetailPage() {
  const { pageId = "" } = useParams();

  return (
    <div className="space-y-4">
      <EmptyState
        icon={FileText}
        title="Página no disponible todavía"
        description={`El editor de la página ${pageId} se implementa en la siguiente ola.`}
      />
    </div>
  );
}
