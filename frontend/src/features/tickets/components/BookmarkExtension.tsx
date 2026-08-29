import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Link as LinkIcon, AlertCircle } from "lucide-react";

import { normalizeUrl, safeHostname } from "./editor/url";

interface OGPData {
  title?: string;
  description?: string;
  image?: { url: string };
  url?: string;
  publisher?: string;
}

export function BookmarkNode({ node }: NodeViewProps) {
  const rawUrl = typeof node.attrs.url === "string" ? node.attrs.url : "";
  const safeUrl = normalizeUrl(rawUrl);
  const [data, setData] = useState<OGPData | null>(null);
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
    // TODO(fase 4): reemplazar por el proxy propio /api/v1/link-preview/.
    fetch(`https://api.microlink.io?url=${encodeURIComponent(safeUrl)}`)
      .then((res) => res.json())
      .then((res) => {
        if (cancelled) return;
        if (res.status === "success") setData(res.data);
        else setError(true);
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

  const previewImage = data?.image?.url ? normalizeUrl(data.image.url) : null;

  return (
    <NodeViewWrapper draggable="true" data-drag-handle>
      <div
        contentEditable={false}
        role="link"
        tabIndex={0}
        className="my-4 flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80 sm:flex-row"
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
              <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3 w-1/4 rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <AlertCircle className="h-4 w-4" />
              <span className="truncate">No se pudo cargar la vista previa de {safeHostname(safeUrl)}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <h4 className="mb-1 line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {data?.title || safeHostname(safeUrl)}
              </h4>
              {data?.description ? (
                <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {data.description}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <LinkIcon className="h-3 w-3" />
                <span className="truncate">{data?.publisher || safeHostname(safeUrl)}</span>
              </div>
            </div>
          )}
        </div>
        {previewImage && !loading && !error ? (
          <div className="h-32 w-full shrink-0 border-t border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 sm:h-auto sm:w-1/3 sm:border-l sm:border-t-0">
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
