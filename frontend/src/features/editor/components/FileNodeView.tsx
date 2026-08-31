"use client";

/**
 * FileNodeView.tsx
 *
 * Tarjeta de un adjunto dentro del documento: icono por tipo, nombre,
 * peso y boton de descarga. Sigue el lenguaje del rediseno brutalista
 * (borde de 2px, sombra dura) y el patron de `VideoNodeView` para el
 * estado de subida.
 *
 * La descarga pasa SIEMPRE por `onDownload`, nunca por un `<a href>`
 * directo: el endpoint exige el header `Authorization`, y un enlace
 * normal lo mandaria sin token y devolveria 401. La URL prefirmada
 * tampoco sirve como `href` estable porque caduca en 5 minutos.
 */

import { useCallback, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Download, Loader2, Trash2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatFileSize, resolveFileKind } from "../lib/fileTypes";
import { useAttachmentDownload } from "../hooks/useAttachmentDownload";

export function FileNodeView({ node, selected, deleteNode, editor }: NodeViewProps) {
  const { attachmentId, fileName, mimeType, size, uploading } = node.attrs as {
    attachmentId: string | null;
    fileName: string;
    mimeType: string;
    size: number;
    uploading: boolean;
  };

  const [isDownloading, setDownloading] = useState(false);
  const download = useAttachmentDownload();

  const spec = resolveFileKind(mimeType, fileName);
  const Icon = spec.icon;
  const isBroken = !uploading && !attachmentId;

  const handleDownload = useCallback(async () => {
    if (!attachmentId || isDownloading) return;
    setDownloading(true);
    try {
      await download(attachmentId, fileName);
    } finally {
      setDownloading(false);
    }
  }, [attachmentId, fileName, download, isDownloading]);

  return (
    <NodeViewWrapper as="div" draggable data-drag-handle style={{ margin: "0.75rem 0" }}>
      <div
        contentEditable={false}
        className={cn(
          "flex items-center gap-3 rounded border-2 bg-card p-3 transition",
          selected ? "border-ring shadow-hard-accent" : "border-border shadow-hard-sm",
          isBroken && "border-destructive/60",
        )}
      >
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded border-2 border-border",
            isBroken ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isBroken ? (
            <TriangleAlert className="h-5 w-5" />
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {fileName || "Archivo sin nombre"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {uploading
              ? "Subiendo…"
              : isBroken
                ? "No se pudo subir este archivo"
                : `${spec.label} · ${formatFileSize(size)}`}
          </span>
        </span>

        {!uploading && !isBroken && (
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            aria-label={`Descargar ${fileName || "archivo"}`}
            title="Descargar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        )}

        {editor.isEditable && (
          <button
            type="button"
            onClick={deleteNode}
            aria-label={`Eliminar ${fileName || "archivo"}`}
            title="Eliminar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-border bg-card text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}
