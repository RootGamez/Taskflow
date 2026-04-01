import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState } from "react";
import { Link as LinkIcon, AlertCircle } from "lucide-react";

interface OGPData {
  title?: string;
  description?: string;
  image?: { url: string };
  url?: string;
  publisher?: string;
}

const BookmarkNode = (props: any) => {
  const { node } = props;
  const url = node.attrs.url;
  const [data, setData] = useState<OGPData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(false);
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.status === "success") {
          setData(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [url]);

  return (
    <NodeViewWrapper draggable="true" data-drag-handle>
      <div
        contentEditable={false}
        className="my-4 flex cursor-pointer select-none flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-800/80 sm:flex-row"
        onClick={() => window.open(url, "_blank")}
      >
        <div className="flex flex-1 flex-col justify-center p-4">
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700"></div>
              <div className="h-3 w-1/2 rounded bg-zinc-100 dark:bg-zinc-800"></div>
              <div className="h-3 w-1/4 rounded bg-zinc-100 dark:bg-zinc-800"></div>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <AlertCircle className="h-4 w-4" />
              <span>No se pudo cargar la vista previa para: {url}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <h4 className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                {data?.title || url}
              </h4>
              {data?.description && (
                <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {data.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
                <LinkIcon className="h-3 w-3" />
                <span className="truncate">{data?.publisher || new URL(url).hostname}</span>
              </div>
            </div>
          )}
        </div>
        {data?.image?.url && !loading && !error && (
          <div className="h-32 w-full shrink-0 border-t border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 sm:h-auto sm:w-1/3 sm:border-l sm:border-t-0">
            <img
              src={data.image.url}
              alt={data?.title || "Vista previa"}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const BookmarkExtension = Node.create({
  name: "bookmark",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (element) => element.getAttribute("href"),
        renderHTML: (attributes) => ({ href: attributes.url }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="bookmark"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, { "data-type": "bookmark", target: "_blank", rel: "noopener noreferrer" }),
      "Bookmark",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkNode);
  },
});
