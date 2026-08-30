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
          className="mb-1.5 flex w-fit items-center gap-0.5 rounded border-2 border-border bg-card/95 p-0.5 shadow-hard dark:shadow-hard-float"
        >
          <button
            type="button"
            title="Copiar URL"
            onPointerDown={(e) => { e.preventDefault(); handleCopyUrl(); }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar URL
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            title="Eliminar video"
            onPointerDown={(e) => { e.preventDefault(); deleteNode(); }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
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
          border: selected ? "2px solid hsl(var(--ring))" : "2px solid hsl(var(--border))",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          boxShadow: selected ? "0 0 0 4px hsl(var(--ring) / 0.25)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        {isUploading ? (
          <div
            className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground"
            style={{
              minHeight: "200px",
              background:
                "linear-gradient(90deg, hsl(var(--card)) 25%, hsl(var(--muted)) 50%, hsl(var(--card)) 75%)",
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
          <div className="flex w-full items-center justify-center gap-2 min-h-[120px] text-sm text-muted-foreground bg-muted">
            <VideoIcon className="h-5 w-5" />
            Video no disponible
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
