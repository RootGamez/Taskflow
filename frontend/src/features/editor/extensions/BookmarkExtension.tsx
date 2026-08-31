import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Link as LinkIcon, AlertCircle } from "lucide-react";

import { apiClient } from "@/lib/axios";
import { normalizeUrl, safeHostname } from "../lib/url";

/** Respuesta de `/api/v1/link-preview/` (apps.linkpreview). */
interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  site_name: string;
}

export function BookmarkNode({ node }: NodeViewProps) {
  const rawUrl = typeof node.attrs.url === "string" ? node.attrs.url : "";
  const safeUrl = normalizeUrl(rawUrl);
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(Boolean(safeUrl));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!safeUrl) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Antes esto llamaba a `api.microlink.io` DIRECTAMENTE desde el
    // navegador: cada URL que alguien pegaba en un ticket viajaba a un
    // tercero junto con la IP del usuario, y la vista previa dependia de la
    // cuota de un servicio ajeno. Ahora va por nuestro backend, que ademas
    // cachea el resultado 24 h.
    apiClient
      .get<LinkPreviewData>("/link-preview/", { params: { url: safeUrl } })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [safeUrl]);

  if (!safeUrl) {
    return (
      <NodeViewWrapper>
        <div
          contentEditable={false}
          className="my-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">URL no válida: {rawUrl || "(vacía)"}</span>
        </div>
      </NodeViewWrapper>
    );
  }

  const previewImage = data?.image ? normalizeUrl(data.image) : null;

  return (
    <NodeViewWrapper draggable="true" data-drag-handle>
      <div
        contentEditable={false}
        role="link"
        tabIndex={0}
        className="my-4 flex cursor-pointer select-none flex-col overflow-hidden rounded border-2 border-border bg-card transition hover:bg-accent sm:flex-row"
        onClick={() => window.open(safeUrl, "_blank", "noopener,noreferrer")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            window.open(safeUrl, "_blank", "noopener,noreferrer");
          }
        }}
      >
        <div className="flex flex-1 flex-col justify-center p-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-3 w-1/4 rounded bg-muted" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="truncate">No se pudo cargar la vista previa de {safeHostname(safeUrl)}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <h4 className="mb-1 line-clamp-1 text-sm font-semibold text-foreground">
                {data?.title || safeHostname(safeUrl)}
              </h4>
              {data?.description ? (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {data.description}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <LinkIcon className="h-3 w-3" />
                <span className="truncate">{data?.site_name || safeHostname(safeUrl)}</span>
              </div>
            </div>
          )}
        </div>
        {previewImage && !loading && !error ? (
          <div className="h-32 w-full shrink-0 border-t-2 border-border bg-muted sm:h-auto sm:w-1/3 sm:border-l-2 sm:border-t-0">
            <img
              src={previewImage}
              alt={data?.title || "Vista previa"}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

export const BookmarkExtension = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
        // Sanea también documentos ya guardados con basura.
        parseHTML: (element) => normalizeUrl(element.getAttribute("href")),
        renderHTML: (attributes) => {
          const safe = normalizeUrl(attributes.url as string | null);
          return safe ? { href: safe } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="bookmark"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "bookmark",
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      "Bookmark",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNode);
  },
});
