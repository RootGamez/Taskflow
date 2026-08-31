/**
 * fileTypes.ts
 *
 * Clasificacion de adjuntos por tipo: que icono le toca, como se muestra
 * su peso y si el navegador puede previsualizarlo.
 *
 * La allowlist tiene que ir en paralelo con `ALLOWED_DOCUMENT_TYPES` de
 * `backend/apps/attachments/storage.py`. El servidor es la autoridad --
 * esto solo evita un viaje de ida y vuelta para rechazar lo obvio.
 */

import {
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  type LucideIcon,
} from "lucide-react";

export type FileKind = "pdf" | "word" | "excel" | "powerpoint" | "archive" | "code" | "text";

interface FileKindSpec {
  kind: FileKind;
  icon: LucideIcon;
  label: string;
  mimeTypes: readonly string[];
  extensions: readonly string[];
}

const FILE_KINDS: readonly FileKindSpec[] = [
  {
    kind: "pdf",
    icon: FileType,
    label: "PDF",
    mimeTypes: ["application/pdf"],
    extensions: [".pdf"],
  },
  {
    kind: "word",
    icon: FileText,
    label: "Word",
    mimeTypes: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.oasis.opendocument.text",
    ],
    extensions: [".doc", ".docx", ".odt"],
  },
  {
    kind: "excel",
    icon: FileSpreadsheet,
    label: "Excel",
    mimeTypes: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.oasis.opendocument.spreadsheet",
      "text/csv",
    ],
    extensions: [".xls", ".xlsx", ".ods", ".csv"],
  },
  {
    kind: "powerpoint",
    icon: Presentation,
    label: "PowerPoint",
    mimeTypes: [
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    extensions: [".ppt", ".pptx"],
  },
  {
    kind: "archive",
    icon: FileArchive,
    label: "Archivo comprimido",
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    extensions: [".zip"],
  },
  {
    kind: "code",
    icon: FileCode,
    label: "Datos",
    mimeTypes: ["application/json"],
    extensions: [".json"],
  },
  {
    kind: "text",
    icon: FileText,
    label: "Texto",
    mimeTypes: ["text/plain", "text/markdown"],
    extensions: [".txt", ".md"],
  },
];

const FALLBACK: FileKindSpec = {
  kind: "text",
  icon: FileText,
  label: "Archivo",
  mimeTypes: [],
  extensions: [],
};

/** Todos los MIME que el editor acepta como adjunto de documento. */
export const ALLOWED_DOCUMENT_TYPES: readonly string[] = FILE_KINDS.flatMap((k) => k.mimeTypes);

/** Todas las extensiones aceptadas, para el `accept` del `<input type="file">`. */
export const ALLOWED_DOCUMENT_EXTENSIONS: readonly string[] = FILE_KINDS.flatMap(
  (k) => k.extensions,
);

export const MAX_ATTACHMENT_SIZE_MB = 50;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/**
 * Resuelve el tipo de un adjunto. Prioriza el MIME y cae en la extension
 * cuando el navegador manda `application/octet-stream`, cosa que hace con
 * demasiada frecuencia para los formatos de Office.
 */
export function resolveFileKind(mimeType: string, fileName: string): FileKindSpec {
  const normalized = (mimeType || "").toLowerCase().split(";")[0].trim();
  const byMime = FILE_KINDS.find((k) => k.mimeTypes.includes(normalized));
  if (byMime) return byMime;

  const extension = extensionOf(fileName || "");
  const byExtension = FILE_KINDS.find((k) => k.extensions.includes(extension));
  return byExtension ?? FALLBACK;
}

/** `true` si el archivo es un documento adjuntable (ni imagen ni video). */
export function isDocumentFile(file: File): boolean {
  const normalized = (file.type || "").toLowerCase().split(";")[0].trim();
  if (ALLOWED_DOCUMENT_TYPES.includes(normalized)) return true;
  return ALLOWED_DOCUMENT_EXTENSIONS.includes(extensionOf(file.name || ""));
}

/** Devuelve el mensaje de error, o `null` si el archivo es valido. */
export function validateDocumentFile(file: File): string | null {
  if (!isDocumentFile(file)) {
    return `Formato no soportado. Usa: ${ALLOWED_DOCUMENT_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
    return `El archivo supera el límite de ${MAX_ATTACHMENT_SIZE_MB} MB.`;
  }
  if (file.size === 0) {
    return "El archivo está vacío.";
  }
  return null;
}

const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** Peso legible: 1536 -> "1,5 KB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  // Los bytes enteros no llevan decimal; el resto, uno.
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toLocaleString("es", { maximumFractionDigits: decimals })} ${SIZE_UNITS[unitIndex]}`;
}
