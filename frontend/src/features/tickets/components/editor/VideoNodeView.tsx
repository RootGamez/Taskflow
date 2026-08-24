"use client";

/**
 * VideoNodeView.tsx
 *
 * React NodeView for the custom Video extension.
 * Features:
 *  - Native HTML5 <video> player with controls
 *  - Upload shimmer while the video is being uploaded (title === "__uploading__")
 *  - Toolbar on selection: Copy URL, Delete
 *  - Preserves src across collaborative sessions via ProseMirror attrs
 */

import { useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Copy, Trash2, Loader2, Video as VideoIcon } from "lucide-react";

export function VideoNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const { src, title } = node.attrs as { src: string; title?: string };
  const isUploading = title === "__uploading__";

  const handleCopyUrl = useCallback(async () => {
    if (src) await navigator.clipboard.writeText(src).catch(() => {});
  }, [src]);

  return (
    <NodeViewWrapper
      as="div"
      draggable
      data-drag-handle
      style={{ display: "block", margin: "0.75rem 0" }}
    >
      {/* Toolbar on selection */}
      {selected && !isUploading && (
        <div
          contentEditable={false}
          className="mb-1.5 flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 w-fit"
        >
          <button
            type="button"
            title="Copiar URL"
            onPointerDown={(e) => { e.preventDefault(); handleCopyUrl(); }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar URL
          </button>
          <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            title="Eliminar video"
            onPointerDown={(e) => { e.preventDefault(); deleteNode(); }}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      )}

      {/* Video content */}
      <div
        contentEditable={false}
        style={{
          border: selected ? "2px solid #3b82f6" : "2px solid transparent",
          borderRadius: "0.5rem",
          overflow: "hidden",
          boxShadow: selected ? "0 0 0 4px #bfdbfe55" : "0 1px 6px rgba(0,0,0,0.10)",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        {isUploading ? (
          <div
            className="flex w-full items-center justify-center gap-2 text-sm text-zinc-400 dark:text-zinc-500"
            style={{
              minHeight: "200px",
              background:
                "linear-gradient(90deg, #f4f4f5 25%, #e4e4e7 50%, #f4f4f5 75%)",
              backgroundSize: "200% 100%",
              animation: "tf-shimmer 1.4s infinite",
            }}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Subiendo video...
          </div>
        ) : src ? (
          <video
            src={src}
            controls
            preload="metadata"
            style={{
              display: "block",
              width: "100%",
              maxHeight: "480px",
              background: "#000",
            }}
          />
        ) : (
          <div className="flex w-full items-center justify-center gap-2 min-h-[120px] text-sm text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
            <VideoIcon className="h-5 w-5" />
            Video no disponible
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
