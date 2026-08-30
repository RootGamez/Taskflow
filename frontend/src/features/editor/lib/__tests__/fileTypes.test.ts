import { describe, expect, it } from "vitest";

import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_TYPES,
  MAX_ATTACHMENT_SIZE_MB,
  formatFileSize,
  isDocumentFile,
  resolveFileKind,
  validateDocumentFile,
} from "../fileTypes";

/** Crea un `File` con un `type` y un `size` deterministas (sin reservar memoria). */
function makeFile(type: string, sizeInBytes = 1_024, name = "archivo"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: sizeInBytes, configurable: true });
  return file;
}

const OCTET_STREAM = "application/octet-stream";
const FORMAT_MESSAGE =
  "Formato no soportado. Usa: .pdf, .doc, .docx, .odt, .xls, .xlsx, .ods, .csv, .ppt, .pptx, .zip, .json, .txt, .md.";

describe("resolveFileKind", () => {
  it("prioriza el MIME sobre la extensión del nombre", () => {
    // Arrange + Act
    const spec = resolveFileKind("application/pdf", "hoja.xlsx");

    // Assert
    expect(spec.kind).toBe("pdf");
    expect(spec.label).toBe("PDF");
  });

  it("cae en la extensión cuando el navegador manda application/octet-stream", () => {
    expect(resolveFileKind(OCTET_STREAM, "informe.docx").kind).toBe("word");
    expect(resolveFileKind(OCTET_STREAM, "cuentas.xlsx").kind).toBe("excel");
    expect(resolveFileKind(OCTET_STREAM, "charla.pptx").kind).toBe("powerpoint");
    expect(resolveFileKind(OCTET_STREAM, "backup.zip").kind).toBe("archive");
  });

  it("usa la extensión cuando el MIME viene vacío", () => {
    expect(resolveFileKind("", "grafico.pptx").kind).toBe("powerpoint");
    expect(resolveFileKind("", "notas.md").kind).toBe("text");
  });

  it("normaliza el MIME: mayúsculas y parámetros como charset", () => {
    expect(resolveFileKind("APPLICATION/PDF", "x").kind).toBe("pdf");
    expect(resolveFileKind("text/plain; charset=utf-8", "notas").kind).toBe("text");
    expect(resolveFileKind("  Text/CSV  ", "x").kind).toBe("excel");
  });

  it("reconoce los MIME nativos de Office", () => {
    expect(
      resolveFileKind(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x",
      ).kind,
    ).toBe("excel");
    expect(
      resolveFileKind(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "x",
      ).kind,
    ).toBe("word");
  });

  it("trata text/csv como hoja de cálculo (Excel)", () => {
    expect(resolveFileKind("text/csv", "datos.csv").kind).toBe("excel");
  });

  it("devuelve el tipo genérico cuando ni el MIME ni la extensión coinciden", () => {
    const unknownByMime = resolveFileKind(OCTET_STREAM, "misterio.bin");
    expect(unknownByMime.kind).toBe("text");
    expect(unknownByMime.label).toBe("Archivo");

    const emptyInput = resolveFileKind("", "");
    expect(emptyInput.kind).toBe("text");
    expect(emptyInput.label).toBe("Archivo");
  });
});

describe("isDocumentFile", () => {
  it("acepta cualquier MIME de la allowlist", () => {
    for (const type of ALLOWED_DOCUMENT_TYPES) {
      expect(isDocumentFile(makeFile(type))).toBe(true);
    }
  });

  it("acepta por extensión cuando el MIME es opaco (octet-stream)", () => {
    expect(isDocumentFile(makeFile(OCTET_STREAM, 10, "informe.docx"))).toBe(true);
    expect(isDocumentFile(makeFile("", 10, "cuentas.xlsx"))).toBe(true);
  });

  it("normaliza el MIME (parámetros) antes de compararlo con la allowlist", () => {
    expect(isDocumentFile(makeFile("application/pdf; charset=binary", 10, "sin-ext"))).toBe(true);
  });

  it("rechaza imágenes, vídeos y tipos fuera de la allowlist", () => {
    expect(isDocumentFile(makeFile("image/png", 10, "foto.png"))).toBe(false);
    expect(isDocumentFile(makeFile(OCTET_STREAM, 10, "clip.mp4"))).toBe(false);
    expect(isDocumentFile(makeFile("", 10, "sinextension"))).toBe(false);
  });
});

describe("validateDocumentFile", () => {
  const LIMIT_BYTES = MAX_ATTACHMENT_SIZE_MB * 1_024 * 1_024;

  it("devuelve null para un documento válido por debajo del límite", () => {
    expect(validateDocumentFile(makeFile("application/pdf", 1_024, "a.pdf"))).toBeNull();
  });

  it("acepta un archivo que pesa exactamente el límite de 50 MB", () => {
    expect(validateDocumentFile(makeFile("application/pdf", LIMIT_BYTES, "a.pdf"))).toBeNull();
  });

  it("rechaza un archivo que supera el límite por un solo byte", () => {
    expect(validateDocumentFile(makeFile("application/pdf", LIMIT_BYTES + 1, "a.pdf"))).toBe(
      "El archivo supera el límite de 50 MB.",
    );
  });

  it("rechaza un formato no soportado con el mensaje exacto de extensiones", () => {
    expect(validateDocumentFile(makeFile("image/png", 10, "foto.png"))).toBe(FORMAT_MESSAGE);
  });

  it("rechaza un archivo vacío cuyo formato sí es válido", () => {
    expect(validateDocumentFile(makeFile("application/pdf", 0, "a.pdf"))).toBe(
      "El archivo está vacío.",
    );
  });

  it("prioriza el error de formato sobre el de tamaño", () => {
    expect(
      validateDocumentFile(makeFile("application/x-msdownload", LIMIT_BYTES * 5, "run.exe")),
    ).toBe(FORMAT_MESSAGE);
  });

  it("prioriza el error de formato sobre el de archivo vacío", () => {
    expect(validateDocumentFile(makeFile("image/png", 0, "foto.png"))).toBe(FORMAT_MESSAGE);
  });
});

describe("formatFileSize", () => {
  it("devuelve '0 B' para cero, negativos y valores no finitos", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(-1_024)).toBe("0 B");
    expect(formatFileSize(Number.NaN)).toBe("0 B");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("0 B");
  });

  it("muestra los bytes enteros sin decimales", () => {
    expect(formatFileSize(1)).toBe("1 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1_023)).toBe("1023 B");
  });

  it("convierte a KB con un decimal y coma como separador", () => {
    expect(formatFileSize(1_024)).toBe("1 KB");
    expect(formatFileSize(1_536)).toBe("1,5 KB");
  });

  it("convierte a MB con un decimal", () => {
    expect(formatFileSize(1_024 * 1_024)).toBe("1 MB");
    expect(formatFileSize(1_024 * 1_024 * 1.5)).toBe("1,5 MB");
  });

  it("convierte a GB con un decimal", () => {
    expect(formatFileSize(1_024 ** 3)).toBe("1 GB");
    expect(formatFileSize(1_024 ** 3 * 1.5)).toBe("1,5 GB");
  });

  it("no escala por encima de GB", () => {
    expect(formatFileSize(1_024 ** 4)).toBe("1024 GB");
  });
});

describe("allowlist de documentos (ALLOWED_DOCUMENT_*)", () => {
  it("expone el límite de tamaño acordado con el backend", () => {
    expect(MAX_ATTACHMENT_SIZE_MB).toBe(50);
  });

  it("ninguna de las dos listas está vacía", () => {
    expect(ALLOWED_DOCUMENT_TYPES.length).toBeGreaterThan(0);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.length).toBeGreaterThan(0);
  });

  it("todas las extensiones empiezan por punto y van en minúsculas", () => {
    for (const extension of ALLOWED_DOCUMENT_EXTENSIONS) {
      expect(extension).toMatch(/^\.[a-z0-9]+$/);
    }
  });

  it("todos los MIME tienen forma tipo/subtipo en minúsculas y sin espacios", () => {
    for (const type of ALLOWED_DOCUMENT_TYPES) {
      expect(type).toMatch(/^[a-z]+\/[a-z0-9.+-]+$/);
    }
  });

  it("no contienen entradas duplicadas", () => {
    expect(new Set(ALLOWED_DOCUMENT_TYPES).size).toBe(ALLOWED_DOCUMENT_TYPES.length);
    expect(new Set(ALLOWED_DOCUMENT_EXTENSIONS).size).toBe(ALLOWED_DOCUMENT_EXTENSIONS.length);
  });

  it("cada MIME de la allowlist resuelve a un tipo concreto que lo reclama", () => {
    for (const type of ALLOWED_DOCUMENT_TYPES) {
      const spec = resolveFileKind(type, "sin-nombre");
      expect(spec.mimeTypes).toContain(type);
    }
  });

  it("cada extensión de la allowlist resuelve por extensión con un MIME opaco", () => {
    for (const extension of ALLOWED_DOCUMENT_EXTENSIONS) {
      const spec = resolveFileKind(OCTET_STREAM, `archivo${extension}`);
      expect(spec.extensions).toContain(extension);
    }
  });

  it("isDocumentFile y validateDocumentFile aceptan toda la allowlist de extensiones", () => {
    for (const extension of ALLOWED_DOCUMENT_EXTENSIONS) {
      const file = makeFile(OCTET_STREAM, 10, `archivo${extension}`);
      expect(isDocumentFile(file)).toBe(true);
      expect(validateDocumentFile(file)).toBeNull();
    }
  });

  it("el mensaje de formato lista exactamente las extensiones permitidas, en orden", () => {
    expect(validateDocumentFile(makeFile("image/png", 10, "x.png"))).toBe(
      `Formato no soportado. Usa: ${ALLOWED_DOCUMENT_EXTENSIONS.join(", ")}.`,
    );
  });
});
