import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Schema, type NodeSpec } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";

import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_TYPES,
  MAX_IMAGE_SIZE_MB,
  MAX_VIDEO_SIZE_MB,
  UPLOADING_MARKER,
  handleImageUpload,
  handleVideoUpload,
  isImageFile,
  isVideoFile,
  validateImageFile,
  validateVideoFile,
} from "../uploads";

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { error: toastErrorMock } }));

/** Crea un `File` con un `type` y un `size` deterministas (sin reservar memoria). */
function makeFile(type: string, sizeInBytes = 1_024, name = "archivo"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: sizeInBytes, configurable: true });
  return file;
}

describe("isImageFile", () => {
  it("acepta todos los MIME de imagen soportados", () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      expect(isImageFile(makeFile(type))).toBe(true);
    }
  });

  it("rechaza tipos que no son imagen soportada", () => {
    expect(isImageFile(makeFile("video/mp4"))).toBe(false);
    expect(isImageFile(makeFile("image/svg+xml"))).toBe(false);
    expect(isImageFile(makeFile("text/plain"))).toBe(false);
    expect(isImageFile(makeFile(""))).toBe(false);
  });
});

describe("isVideoFile", () => {
  it("acepta todos los MIME de video soportados", () => {
    for (const type of ALLOWED_VIDEO_TYPES) {
      expect(isVideoFile(makeFile(type))).toBe(true);
    }
  });

  it("rechaza tipos que no son video soportado", () => {
    expect(isVideoFile(makeFile("image/png"))).toBe(false);
    expect(isVideoFile(makeFile("video/avi"))).toBe(false);
    expect(isVideoFile(makeFile("application/octet-stream"))).toBe(false);
    expect(isVideoFile(makeFile(""))).toBe(false);
  });
});

describe("validateImageFile", () => {
  const LIMIT_BYTES = MAX_IMAGE_SIZE_MB * 1_024 * 1_024;

  it("devuelve null para una imagen con tipo válido y tamaño por debajo del límite", () => {
    expect(validateImageFile(makeFile("image/png", 500))).toBeNull();
  });

  it("acepta un archivo que pesa exactamente el límite", () => {
    expect(validateImageFile(makeFile("image/jpeg", LIMIT_BYTES))).toBeNull();
  });

  it("rechaza un archivo que supera el límite por un solo byte", () => {
    expect(validateImageFile(makeFile("image/jpeg", LIMIT_BYTES + 1))).toBe(
      "La imagen supera el límite de 10 MB.",
    );
  });

  it("rechaza un tipo no soportado con el mensaje exacto de formatos", () => {
    expect(validateImageFile(makeFile("image/svg+xml", 10))).toBe(
      "Formato no soportado. Usa: .jpg, .jpeg, .png, .webp, .gif.",
    );
  });

  it("prioriza el error de formato sobre el de tamaño", () => {
    expect(validateImageFile(makeFile("text/plain", LIMIT_BYTES * 5))).toBe(
      "Formato no soportado. Usa: .jpg, .jpeg, .png, .webp, .gif.",
    );
  });
});

describe("validateVideoFile", () => {
  const LIMIT_BYTES = MAX_VIDEO_SIZE_MB * 1_024 * 1_024;

  it("devuelve null para un video con tipo válido y tamaño por debajo del límite", () => {
    expect(validateVideoFile(makeFile("video/mp4", 1_000))).toBeNull();
  });

  it("acepta un archivo que pesa exactamente el límite", () => {
    expect(validateVideoFile(makeFile("video/webm", LIMIT_BYTES))).toBeNull();
  });

  it("rechaza un archivo que supera el límite por un solo byte", () => {
    expect(validateVideoFile(makeFile("video/webm", LIMIT_BYTES + 1))).toBe(
      "El video supera el límite de 200 MB.",
    );
  });

  it("rechaza un tipo no soportado con el mensaje exacto de formatos", () => {
    expect(validateVideoFile(makeFile("video/avi", 10))).toBe(
      "Formato no soportado. Usa: .mp4, .webm, .mov, .avi, .mkv, .ogv.",
    );
  });

  it("prioriza el error de formato sobre el de tamaño", () => {
    expect(validateVideoFile(makeFile("image/png", LIMIT_BYTES * 5))).toBe(
      "Formato no soportado. Usa: .mp4, .webm, .mov, .avi, .mkv, .ogv.",
    );
  });
});

describe("constantes de uploads", () => {
  it("expone la lista canónica de MIME/extensiones de imagen", () => {
    expect(ALLOWED_IMAGE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    expect(ALLOWED_IMAGE_EXTENSIONS).toEqual([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
    expect(MAX_IMAGE_SIZE_MB).toBe(10);
  });

  it("expone la lista canónica de MIME/extensiones de video", () => {
    expect(ALLOWED_VIDEO_TYPES).toEqual([
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/ogg",
    ]);
    expect(ALLOWED_VIDEO_EXTENSIONS).toEqual([".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv"]);
    expect(MAX_VIDEO_SIZE_MB).toBe(200);
  });

  it("usa el marcador de subida que leen los NodeView", () => {
    expect(UPLOADING_MARKER).toBe("__uploading__");
  });
});

// --- Subida optimista sobre ProseMirror -------------------------------------
//
// `handleImageUpload` / `handleVideoUpload` tocan una `EditorView`. En vez de
// montar Tiptap+React se usa un esquema mínimo de ProseMirror y una `view`
// falsa cuyo `dispatch` aplica la transacción sobre un estado mutable. Es
// suficiente para observar el ciclo insertar-optimista → reconciliar.

interface FakeView {
  state: EditorState;
  dispatch: (tr: unknown) => void;
}

function createMediaSchema(nodeName: "image" | "video"): Schema {
  const mediaNode: NodeSpec = {
    group: "block",
    atom: true,
    attrs: { src: { default: null }, alt: { default: null }, title: { default: null } },
    toDOM: (node) => ["div", node.attrs],
  };
  const nodes: Record<string, NodeSpec> = {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    [nodeName]: mediaNode,
    text: { group: "inline" },
  };
  return new Schema({ nodes });
}

function createFakeView(schema: Schema): FakeView {
  let state = EditorState.create({
    schema,
    doc: schema.node("doc", null, [schema.node("paragraph")]),
  });
  return {
    get state() {
      return state;
    },
    set state(next: EditorState) {
      state = next;
    },
    dispatch(tr: unknown) {
      state = state.apply(tr as Parameters<EditorState["apply"]>[0]);
    },
  };
}

function mediaAttrs(view: FakeView, nodeName: "image" | "video"): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  view.state.doc.descendants((node) => {
    if (node.type.name === nodeName) found.push(node.attrs as Record<string, unknown>);
  });
  return found;
}

/** Deja que se resuelvan las promesas y los `import()` dinámicos pendientes. */
async function flushAsync(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("handleImageUpload / handleVideoUpload", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-object-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    toastErrorMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserta un nodo optimista con el marcador de subida mientras sube la imagen", () => {
    const view = createFakeView(createMediaSchema("image"));
    const uploadFn = vi.fn(() => new Promise<string>(() => {})); // nunca resuelve

    handleImageUpload(view as never, makeFile("image/png", 10, "foto.png"), uploadFn);

    expect(mediaAttrs(view, "image")).toEqual([
      { src: "blob:mock-object-url", alt: "foto.png", title: UPLOADING_MARKER },
    ]);
    expect(uploadFn).toHaveBeenCalledTimes(1);
  });

  it("al resolver, cambia el src por la URL pública y limpia el marcador", async () => {
    const view = createFakeView(createMediaSchema("image"));
    const uploadFn = vi.fn(() => Promise.resolve("https://cdn.example/foto.png"));

    handleImageUpload(view as never, makeFile("image/png", 10, "foto.png"), uploadFn);
    await flushAsync();

    const [attrs] = mediaAttrs(view, "image");
    expect(attrs.src).toBe("https://cdn.example/foto.png");
    expect(attrs.title).not.toBe(UPLOADING_MARKER);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-object-url");
  });

  it("al fallar, borra el nodo optimista y muestra un toast de error", async () => {
    const view = createFakeView(createMediaSchema("video"));
    const uploadFn = vi.fn(() => Promise.reject(new Error("network")));

    handleVideoUpload(view as never, makeFile("video/mp4", 10, "clip.mp4"), uploadFn);
    await flushAsync();

    expect(mediaAttrs(view, "video")).toHaveLength(0);
    expect(toastErrorMock).toHaveBeenCalledWith("No se pudo subir el video.");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-object-url");
  });

  it("usa el mensaje de error propio de cada tipo de media", async () => {
    const view = createFakeView(createMediaSchema("image"));

    handleImageUpload(
      view as never,
      makeFile("image/png", 10, "foto.png"),
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    await flushAsync();

    expect(toastErrorMock).toHaveBeenCalledWith("No se pudo subir la imagen.");
  });

  it("respeta insertAtPos para colocar el nodo en una posición explícita", () => {
    const view = createFakeView(createMediaSchema("image"));

    handleImageUpload(
      view as never,
      makeFile("image/png", 10, "foto.png"),
      vi.fn(() => new Promise<string>(() => {})),
      0,
    );

    expect(view.state.doc.firstChild?.type.name).toBe("image");
  });

  it("no hace nada (ni lanza) si el esquema no tiene el nodo de media", () => {
    const schema = new Schema({ nodes: { doc: { content: "text*" }, text: {} } });
    let state = EditorState.create({ schema });
    const dispatch = vi.fn();
    const view = {
      get state() {
        return state;
      },
      set state(next: EditorState) {
        state = next;
      },
      dispatch,
    };

    expect(() =>
      handleVideoUpload(view as never, makeFile("video/mp4", 10), vi.fn(() => Promise.resolve("x"))),
    ).not.toThrow();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
