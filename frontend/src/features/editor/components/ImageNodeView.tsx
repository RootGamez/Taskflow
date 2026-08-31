"use client";

/**
 * ImageNodeView.tsx
 *
 * React NodeView for the Tiptap Image extension.
 * Features:
 *  - Drag-to-resize via corner/edge handles (updates `width` + `height` attrs)
 *  - Toolbar on selection: Open URL, Copy URL, Delete, Edit Alt
 *  - Optimistic blob:// preview → replaced by final URL after upload
 */

import { useRef, useState, useCallback, useEffect } from "react";
import {
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import {
  ExternalLink,
  Copy,
  Trash2,
  Type,
  Loader2,
} from "lucide-react";

const HANDLE_SIZE = 10;

type ResizeDir =
  | "se" | "sw" | "ne" | "nw"
  | "e"  | "w"  | "n"  | "s";

interface ResizeState {
  active: boolean;
  dir: ResizeDir;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export function ImageNodeView({
  node,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const { src, alt, title, width, height } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    width?: number;
    height?: number;
  };

  const isUploading = title === "__uploading__";

  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Displayed dimensions
  const [displayWidth, setDisplayWidth] = useState<number | null>(width ?? null);
  const [displayHeight, setDisplayHeight] = useState<number | null>(height ?? null);
  const [showAltEdit, setShowAltEdit] = useState(false);
  const [altValue, setAltValue] = useState(alt ?? "");

  const resizeRef = useRef<ResizeState | null>(null);

  // When image loads for the first time without stored dimensions, capture natural size
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    if (!displayWidth || !displayHeight) {
      const natural = img.naturalWidth;
      // Cap at container width
      const wrap = wrapRef.current?.parentElement as HTMLElement | null;
      const maxW = wrap?.clientWidth ?? natural;
      const finalW = Math.min(natural, maxW);
      const finalH = Math.round((img.naturalHeight / natural) * finalW);
      setDisplayWidth(finalW);
      setDisplayHeight(finalH);
    }
  }, [displayWidth, displayHeight]);

  // ── Resize logic ───────────────────────────────────────────────────────────

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, dir: ResizeDir) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      resizeRef.current = {
        active: true,
        dir,
        startX: e.clientX,
        startY: e.clientY,
        startW: displayWidth ?? imgRef.current?.naturalWidth ?? 400,
        startH: displayHeight ?? imgRef.current?.naturalHeight ?? 300,
      };
    },
    [displayWidth, displayHeight]
  );

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const rs = resizeRef.current;
    if (!rs?.active) return;

    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;
    const ar = rs.startH / rs.startW;

    let newW = rs.startW;
    let newH = rs.startH;

    if (rs.dir.includes("e")) newW = Math.max(80, rs.startW + dx);
    if (rs.dir.includes("w")) newW = Math.max(80, rs.startW - dx);
    if (rs.dir.includes("s")) newH = Math.max(60, rs.startH + dy);
    if (rs.dir.includes("n")) newH = Math.max(60, rs.startH - dy);

    // Corner handles: preserve aspect ratio
    if (rs.dir.length === 2) {
      if (rs.dir.includes("e") || rs.dir.includes("w")) {
        newH = Math.round(newW * ar);
      } else {
        newW = Math.round(newH / ar);
      }
    }

    setDisplayWidth(Math.round(newW));
    setDisplayHeight(Math.round(newH));
  }, []);

  const handlePointerUp = useCallback(() => {
    const rs = resizeRef.current;
    if (!rs?.active) return;
    resizeRef.current = null;
    // Persist to the node attrs so collaborators see it
    updateAttributes({ width: displayWidth, height: displayHeight });
  }, [displayWidth, displayHeight, updateAttributes]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // ── Toolbar actions ────────────────────────────────────────────────────────

  const handleCopyUrl = useCallback(async () => {
    if (src) await navigator.clipboard.writeText(src).catch(() => {});
  }, [src]);

  const handleOpenUrl = useCallback(() => {
    if (src && !src.startsWith("blob:")) window.open(src, "_blank", "noopener,noreferrer");
  }, [src]);

  const handleDeleteNode = useCallback(() => {
    deleteNode();
  }, [deleteNode]);

  const applyAltEdit = useCallback(() => {
    updateAttributes({ alt: altValue });
    setShowAltEdit(false);
  }, [altValue, updateAttributes]);

  // ── Resize handle positions ────────────────────────────────────────────────

  const handles: { dir: ResizeDir; style: React.CSSProperties }[] = [
    { dir: "se", style: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: "se-resize" } },
    { dir: "sw", style: { bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: "sw-resize" } },
    { dir: "ne", style: { top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: "ne-resize" } },
    { dir: "nw", style: { top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: "nw-resize" } },
    { dir: "e",  style: { top: "50%", right: -HANDLE_SIZE / 2, transform: "translateY(-50%)", cursor: "e-resize" } },
    { dir: "w",  style: { top: "50%", left: -HANDLE_SIZE / 2, transform: "translateY(-50%)", cursor: "w-resize" } },
    { dir: "n",  style: { top: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
    { dir: "s",  style: { bottom: -HANDLE_SIZE / 2, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
  ];

  return (
    <NodeViewWrapper
      as="div"
      draggable
      data-drag-handle
      style={{ display: "block", lineHeight: 0, margin: "0.75rem 0" }}
    >
      {/* Alt text editor */}
      {showAltEdit && (
        <div className="mb-1 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={altValue}
            onChange={(e) => setAltValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyAltEdit();
              if (e.key === "Escape") setShowAltEdit(false);
            }}
            placeholder="Texto alternativo..."
            className="h-8 w-48 rounded border-2 border-border bg-card px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); applyAltEdit(); }}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
          >
            OK
          </button>
        </div>
      )}

      {/* Toolbar (shown when node is selected) */}
      {selected && !isUploading && (
        <div
          contentEditable={false}
          className="mb-1.5 flex w-fit items-center gap-0.5 rounded border-2 border-border bg-card/95 p-0.5 shadow-hard dark:shadow-hard-float"
        >
          {!src.startsWith("blob:") && (
            <button
              type="button"
              title="Abrir imagen"
              onPointerDown={(e) => { e.preventDefault(); handleOpenUrl(); }}
              className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir
            </button>
          )}
          <button
            type="button"
            title="Copiar URL"
            onPointerDown={(e) => { e.preventDefault(); handleCopyUrl(); }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar URL
          </button>
          <button
            type="button"
            title="Editar alt"
            onPointerDown={(e) => { e.preventDefault(); setShowAltEdit((v) => !v); }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Type className="h-3.5 w-3.5" />
            Alt
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            title="Eliminar imagen"
            onPointerDown={(e) => { e.preventDefault(); handleDeleteNode(); }}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Eliminar
          </button>
        </div>
      )}

      {/* Image wrapper with resize handles */}
      <div
        ref={wrapRef}
        style={{
          position: "relative",
          display: "inline-block",
          maxWidth: "100%",
          width: displayWidth ? `${displayWidth}px` : "100%",
          height: displayHeight ? `${displayHeight}px` : "auto",
          lineHeight: 0,
          userSelect: "none",
        }}
        contentEditable={false}
      >
        {/* Loading shimmer */}
        {isUploading ? (
          <div
            className="flex w-full items-center justify-center gap-2 rounded text-sm text-muted-foreground"
            style={{
              minHeight: "180px",
              background:
                "linear-gradient(90deg, hsl(var(--card)) 25%, hsl(var(--muted)) 50%, hsl(var(--card)) 75%)",
              backgroundSize: "200% 100%",
              animation: "tf-shimmer 1.4s infinite",
            }}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Subiendo imagen...
          </div>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={alt ?? ""}
            title={title ?? undefined}
            onLoad={handleImageLoad}
            draggable={false}
            style={{
              display: "block",
              width: displayWidth ? `${displayWidth}px` : "100%",
              height: displayHeight ? `${displayHeight}px` : "auto",
              borderRadius: "var(--radius)",
              boxShadow: selected
                ? "0 0 0 2px hsl(var(--ring)), 0 0 0 5px hsl(var(--ring) / 0.25)"
                : "0 0 0 2px hsl(var(--border))",
              transition: "box-shadow 0.15s",
              cursor: "default",
              objectFit: "contain",
            }}
          />
        )}

        {/* Resize handles (only shown when node is selected and not uploading) */}
        {selected && !isUploading && handles.map(({ dir, style }) => (
          <div
            key={dir}
            data-resize-handle={dir}
            onPointerDown={(e) => startResize(e, dir)}
            style={{
              position: "absolute",
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              background: "hsl(var(--primary))",
              border: "2px solid hsl(var(--background))",
              borderRadius: "2px",
              zIndex: 10,
              touchAction: "none",
              ...style,
            }}
          />
        ))}
      </div>
    </NodeViewWrapper>
  );
}
