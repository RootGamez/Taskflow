"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckSquare2,
  Code2,
  Heading2,
  Heading3,
  ImageIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Minus,
  Link as LinkIcon,
  Trash2,
  ExternalLink,
  Table as TableIcon,
  Video as VideoIcon,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Code as InlineCodeIcon,
  Highlighter as HighlighterIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Columns3,
  Rows3,
} from "lucide-react";
import {
  EditorContent,
  type Editor,
  useEditor,
  ReactNodeViewRenderer,
  Extension,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Dropcursor from "@tiptap/extension-dropcursor";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";

import { BookmarkExtension } from "./BookmarkExtension";
import { normalizeUrl } from "./editor/url";
import { createSharedExtensions } from "./editor/sharedExtensions";
import { useUrlPrompt, type RequestUrlFn } from "./editor/useUrlPrompt";
import { SlashExtension, type SlashCommandItem } from "./extensions/SlashExtension";
import { VideoExtension } from "./extensions/VideoExtension";
import { SlashCommandMenu, createSlashMenuRenderer, type SlashMenuReactState } from "./editor/SlashCommandMenu";
import { BlockControls } from "./editor/BlockControls";
import { ImageNodeView } from "./editor/ImageNodeView";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Upload function: receives a File, resolves with the public URL */
export type ImageUploadFn = (file: File) => Promise<string>;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_IMAGE_SIZE_MB = 10;

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msoideo", "video/x-matroska", "video/ogg"];
const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".avi", ".mkv", ".ogv"];
const MAX_VIDEO_SIZE_MB = 200;

function isImageFile(file: File): boolean {
  return ALLOWED_IMAGE_TYPES.includes(file.type);
}

function isVideoFile(file: File): boolean {
  return ALLOWED_VIDEO_TYPES.includes(file.type);
}

function validateImageFile(file: File): string | null {
  if (!isImageFile(file)) {
    return `Formato no soportado. Usa: ${ALLOWED_IMAGE_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `La imagen supera el límite de ${MAX_IMAGE_SIZE_MB} MB.`;
  }
  return null;
}

function validateVideoFile(file: File): string | null {
  if (!isVideoFile(file)) {
    return `Formato no soportado. Usa: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}.`;
  }
  if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
    return `El video supera el límite de ${MAX_VIDEO_SIZE_MB} MB.`;
  }
  return null;
}

interface TicketRichEditorProps {
  /** ProseMirror JSON or null */
  value: Record<string, unknown> | null;
  placeholder?: string;
  disabled?: boolean;
  isLocked?: boolean;
  lockHint?: string;
  /** Emits ProseMirror JSON (not HTML) */
  onChange: (value: Record<string, unknown>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Upload function: receives a File, resolves with public URL */
  onUploadImage?: ImageUploadFn;
  /** Upload function for videos: receives a File, resolves with public URL */
  onUploadVideo?: ImageUploadFn;
}

// ─── Editor styles (injected once as a <style> tag) ──────────────────────────

const EDITOR_STYLES = `
.tf-editor .tiptap {
  outline: none;
  min-height: 220px;
  padding: 0;
  font-size: 15px;
  line-height: 1.75;
  color: #1c1c1e;
}
.dark .tf-editor .tiptap { color: #f4f4f5; }

/* Placeholder */
.tf-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: #a1a1aa;
  float: left;
  height: 0;
  pointer-events: none;
}

.tf-editor .tiptap p { margin: 0 0 0.25rem 0; }

.tf-editor .tiptap h2 {
  font-size: 1.5rem; font-weight: 700; line-height: 1.3;
  margin: 1.5rem 0 0.5rem; color: #111827;
}
.dark .tf-editor .tiptap h2 { color: #f9fafb; }

.tf-editor .tiptap h3 {
  font-size: 1.2rem; font-weight: 600; line-height: 1.4;
  margin: 1.25rem 0 0.4rem; color: #1f2937;
}
.dark .tf-editor .tiptap h3 { color: #f3f4f6; }

.tf-editor .tiptap ul, .tf-editor .tiptap ol {
  margin: 0.25rem 0 0.5rem 1.5rem; padding: 0;
}
.tf-editor .tiptap ul { list-style-type: disc; }
.tf-editor .tiptap ol { list-style-type: decimal; }
.tf-editor .tiptap li { margin: 0.1rem 0; }
.tf-editor .tiptap li > p { margin: 0; }

/* Checklist */
.tf-editor .tiptap ul[data-type="taskList"] { list-style: none; margin-left: 0; }
.tf-editor .tiptap ul[data-type="taskList"] li {
  display: flex; align-items: flex-start; gap: 0.5rem;
}
.tf-editor .tiptap ul[data-type="taskList"] li > label {
  flex-shrink: 0; margin-top: 0.25rem;
}
.tf-editor .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  width: 1rem; height: 1rem; cursor: pointer; accent-color: #2563eb;
}
.tf-editor .tiptap ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through; color: #9ca3af;
}

.tf-editor .tiptap blockquote {
  border-left: 3px solid #e4e4e7;
  padding-left: 1rem; margin: 0.5rem 0;
  color: #71717a; font-style: italic;
}
.dark .tf-editor .tiptap blockquote { border-left-color: #3f3f46; color: #a1a1aa; }

.tf-editor .tiptap code {
  background: #f4f4f5; border-radius: 0.25rem;
  padding: 0.1em 0.35em;
  font-family: ui-monospace,'Cascadia Code',monospace;
  font-size: 0.85em; color: #dc2626;
}
.dark .tf-editor .tiptap code { background: #27272a; color: #f87171; }

.tf-editor .tiptap pre {
  background: #18181b; border-radius: 0.5rem;
  padding: 1rem 1.25rem; margin: 0.5rem 0; overflow-x: auto;
}
.tf-editor .tiptap pre code {
  background: none; color: #e4e4e7; padding: 0; font-size: 0.875rem;
}

.tf-editor .tiptap hr {
  border: none; border-top: 1px solid #e4e4e7; margin: 1rem 0;
}
.dark .tf-editor .tiptap hr { border-top-color: #3f3f46; }

.tf-editor .tiptap a {
  color: #2563eb; text-decoration: underline; text-underline-offset: 2px;
}
.tf-editor .tiptap a:hover { color: #1d4ed8; }

.tf-editor .tiptap ::selection { background: #bfdbfe; }
.dark .tf-editor .tiptap ::selection { background: #1e40af40; }

.tf-editor .tiptap .ProseMirror-dropcursor { border-top: 2px solid #3b82f6; }

/* Slash suggestion decoration */
.tf-editor .tiptap .suggestion { color: #a1a1aa; }

/* Shimmer animation for image upload placeholder */
@keyframes tf-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

// ─── Image upload helper ──────────────────────────────────────────────────────

function handleImageUpload(
  view: Editor["view"],
  file: File,
  uploadFn: ImageUploadFn,
  insertAtPos?: number,
) {
  const { state } = view;
  const imageNodeType = state.schema.nodes.image;
  if (!imageNodeType) return;

  // Optimistic local preview
  const objectUrl = URL.createObjectURL(file);
  const previewNode = imageNodeType.create({
    src: objectUrl,
    alt: file.name,
    title: "__uploading__",
  });

  const { tr } = state;
  // If no position given, insert after current selection
  const pos = insertAtPos ?? state.selection.to;
  tr.insert(pos, previewNode);
  view.dispatch(tr);

  uploadFn(file)
    .then((publicUrl) => {
      const { state: nextState } = view;
      nextState.doc.descendants((node, nodePos) => {
        if (node.type.name === "image" && node.attrs.src === objectUrl) {
          const update = view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...node.attrs,
            src: publicUrl,
            title: undefined,
          });
          view.dispatch(update);
          URL.revokeObjectURL(objectUrl);
        }
      });
    })
    .catch(async () => {
      const { state: errState } = view;
      errState.doc.descendants((node, nodePos) => {
        if (node.type.name === "image" && node.attrs.src === objectUrl) {
          const removal = view.state.tr.delete(nodePos, nodePos + node.nodeSize);
          view.dispatch(removal);
          URL.revokeObjectURL(objectUrl);
        }
      });
      const { default: toast } = await import("react-hot-toast");
      toast.error("No se pudo subir la imagen.");
    });
}

// ─── Video upload helper ──────────────────────────────────────────────────────

function handleVideoUpload(
  view: Editor["view"],
  file: File,
  uploadFn: ImageUploadFn,
  insertAtPos?: number,
) {
  const { state } = view;
  const videoNodeType = state.schema.nodes.video;
  if (!videoNodeType) return;

  const objectUrl = URL.createObjectURL(file);
  const previewNode = videoNodeType.create({
    src: objectUrl,
    title: "__uploading__",
  });

  const { tr } = state;
  const pos = insertAtPos ?? state.selection.to;
  tr.insert(pos, previewNode);
  view.dispatch(tr);

  uploadFn(file)
    .then((publicUrl) => {
      const { state: nextState } = view;
      nextState.doc.descendants((node, nodePos) => {
        if (node.type.name === "video" && node.attrs.src === objectUrl) {
          const update = view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...node.attrs,
            src: publicUrl,
            title: undefined,
          });
          view.dispatch(update);
          URL.revokeObjectURL(objectUrl);
        }
      });
    })
    .catch(async () => {
      const { state: errState } = view;
      errState.doc.descendants((node, nodePos) => {
        if (node.type.name === "video" && node.attrs.src === objectUrl) {
          const removal = view.state.tr.delete(nodePos, nodePos + node.nodeSize);
          view.dispatch(removal);
          URL.revokeObjectURL(objectUrl);
        }
      });
      const { default: toast } = await import("react-hot-toast");
      toast.error("No se pudo subir el video.");
    });
}

// ─── Block option definitions ─────────────────────────────────────────────────

function useBlockOptions(
  editor: Editor | null,
  onUploadImage?: ImageUploadFn,
  onUploadVideo?: ImageUploadFn,
  triggerImage?: (() => void) | null,
  triggerVideo?: (() => void) | null,
  requestUrl?: RequestUrlFn,
): SlashCommandItem[] {
  return useMemo<SlashCommandItem[]>(() => {
    if (!editor) return [];
    return [
      {
        id: "paragraph",
        label: "Párrafo",
        description: "Texto normal",
        group: "basic",
        keywords: ["texto", "normal", "paragraph", "parrafo", "p"],
        icon: Pilcrow,
        apply: (e) => e.chain().focus().setParagraph().run(),
      },
      {
        id: "heading-2",
        label: "Título grande",
        description: "Encabezado H2",
        group: "basic",
        keywords: ["titulo", "heading", "h2", "grande"],
        icon: Heading2,
        apply: (e) => e.chain().focus().setHeading({ level: 2 }).run(),
      },
      {
        id: "heading-3",
        label: "Título mediano",
        description: "Encabezado H3",
        group: "basic",
        keywords: ["titulo", "heading", "h3", "mediano"],
        icon: Heading3,
        apply: (e) => e.chain().focus().setHeading({ level: 3 }).run(),
      },
      {
        id: "divider",
        label: "Divisor",
        description: "Línea horizontal",
        group: "basic",
        keywords: ["divisor", "separador", "hr", "linea"],
        icon: Minus,
        apply: (e) => e.chain().focus().setHorizontalRule().run(),
      },
      {
        id: "bullet-list",
        label: "Lista",
        description: "Lista con viñetas",
        group: "lists",
        keywords: ["lista", "bullet", "ul", "viñeta"],
        icon: List,
        apply: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        id: "ordered-list",
        label: "Lista numerada",
        description: "Lista con números",
        group: "lists",
        keywords: ["lista", "numerada", "ordered", "ol", "numero"],
        icon: ListOrdered,
        apply: (e) => e.chain().focus().toggleOrderedList().run(),
      },
      {
        id: "task-list",
        label: "Checklist",
        description: "Lista con casillas",
        group: "lists",
        keywords: ["check", "tarea", "todo", "checklist", "casilla"],
        icon: CheckSquare2,
        apply: (e) => e.chain().focus().toggleTaskList().run(),
      },
      {
        id: "quote",
        label: "Cita",
        description: "Bloque de cita",
        group: "advanced",
        keywords: ["quote", "cita", "blockquote"],
        icon: Quote,
        apply: (e) => e.chain().focus().toggleBlockquote().run(),
      },
      {
        id: "code",
        label: "Código",
        description: "Bloque de código con resaltado",
        group: "advanced",
        keywords: ["code", "codigo", "snippet", "bloque", "pre"],
        icon: Code2,
        apply: (e) => e.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "table",
        label: "Tabla",
        description: "Insertar una tabla 3×3",
        group: "advanced",
        keywords: ["tabla", "table", "grid", "filas", "columnas"],
        icon: TableIcon,
        apply: (e) =>
          e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      {
        id: "bookmark",
        label: "Enlace visual",
        description: "Tarjeta de vista previa web",
        group: "advanced",
        keywords: ["bookmark", "enlace", "link", "tarjeta", "card", "ogp"],
        icon: LinkIcon,
        apply: (e) => {
          void requestUrl?.("URL para previsualizar").then((url) => {
            const safe = normalizeUrl(url);
            if (safe) {
              e.chain().focus().insertContent({ type: "bookmark", attrs: { url: safe } }).run();
            }
          });
        },
      },
      ...(onUploadImage
        ? [
            {
              id: "image",
              label: "Imagen",
              description: "Sube una imagen desde tu equipo",
              group: "media" as const,
              keywords: ["imagen", "foto", "image", "picture", "img", "upload"],
              icon: ImageIcon,
              apply: (_e: Editor) => { triggerImage?.(); },
            },
            {
              id: "video",
              label: "Video",
              description: "Sube un video (MP4, WebM, MOV...)",
              group: "media" as const,
              keywords: ["video", "mp4", "webm", "mov", "pelicula", "clip", "upload"],
              icon: VideoIcon,
              apply: (_e: Editor) => { triggerVideo?.(); },
            },
          ]
        : []),
    ];
  }, [editor, onUploadImage, onUploadVideo, triggerImage, triggerVideo, requestUrl]);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TicketRichEditor({
  value,
  placeholder = "Escribe algo, o presiona '/' para insertar un bloque...",
  disabled = false,
  isLocked = false,
  lockHint,
  onChange,
  onFocus,
  onBlur,
  onUploadImage,
  onUploadVideo,
}: TicketRichEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { requestUrl, urlPromptDialog } = useUrlPrompt();
  const onChangeRef = useRef(onChange);
  const onUploadImageRef = useRef(onUploadImage);
  const onUploadVideoRef = useRef(onUploadVideo);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Keep refs in sync (stable reference for extensions)
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onUploadImageRef.current = onUploadImage; }, [onUploadImage]);
  useEffect(() => { onUploadVideoRef.current = onUploadVideo; }, [onUploadVideo]);

  const triggerImageFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const triggerVideoFileInput = useCallback(() => {
    videoFileInputRef.current?.click();
  }, []);

  // ── Slash menu state (driven by @tiptap/suggestion lifecycle) ─────────────

  const [slashMenuState, setSlashMenuState] = useState<SlashMenuReactState>({
    items: [],
    command: () => {},
    clientRect: null,
    isVisible: false,
  });

  // Ref that the SlashCommandMenu sets so the renderer can call its key handler
  const slashKeyDownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null);

  // ── Build extensions ───────────────────────────────────────────────────────

  const blockOptions = useBlockOptions(null, onUploadImage, onUploadVideo, triggerImageFileInput, triggerVideoFileInput, requestUrl);

  // Stable renderer factory — passes both setState and the keyDown ref
  const slashRenderer = useMemo(
    () => createSlashMenuRenderer(setSlashMenuState, slashKeyDownRef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        dropcursor: false,
        // Reemplazado por CodeBlockLowlight (mismo nombre de nodo).
        codeBlock: false,
      }),
      ...createSharedExtensions(),

      // Image with React NodeView (resize + toolbar)
      Image.configure({
        inline: false,
        allowBase64: false,
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(ImageNodeView);
        },
      }),

      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class:
            "cursor-pointer font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline underline-offset-2",
        },
      }),

      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),

      Dropcursor.configure({ color: "#3b82f6", width: 2 }),
      TaskList,
      TaskItem.configure({ nested: true }),
      BookmarkExtension,
      VideoExtension,

      // ── Slash command (official @tiptap/suggestion) ───────────────────────
      SlashExtension.configure({
        suggestion: {
          char: "/",
          startOfLine: true,
          allowSpaces: false,
          items: ({ query }: { query: string }) => {
            if (!query) return blockOptions;
            const q = query.toLowerCase();
            return blockOptions.filter(
              (o) =>
                o.label.toLowerCase().includes(q) ||
                o.keywords.some((k) => k.includes(q))
            );
          },
          render: slashRenderer,
          command: ({ editor: e, range, props }: { editor: Editor; range: { from: number; to: number }; props: SlashCommandItem }) => {
            e.chain().focus().deleteRange(range).run();
            props.apply(e);
            if (props.id === "image") triggerImageFileInput();
            if (props.id === "video") triggerVideoFileInput();
          },
        },
      }),

      // ── Paste & drop media upload (ESM — no require) ─────────────────────
      Extension.create({
        name: "mediaUpload",
        addProseMirrorPlugins() {
          return [
            new Plugin({
              key: new PluginKey("mediaUpload"),
              props: {
                handlePaste(view, event) {
                  const items = Array.from(
                    (event as ClipboardEvent).clipboardData?.items ?? [],
                  );
                  const mediaItem = items.find(
                    (i) => i.kind === "file" && (isImageFile(i.getAsFile()!) || isVideoFile(i.getAsFile()!)),
                  );
                  if (!mediaItem) return false;
                  const file = mediaItem.getAsFile();
                  if (!file) return false;
                  
                  (event as ClipboardEvent).preventDefault();
                  if (isImageFile(file)) {
                    const uploadFn = onUploadImageRef.current;
                    if (!uploadFn) return false;
                    handleImageUpload(view, file, uploadFn);
                  } else {
                    const uploadFn = onUploadVideoRef.current;
                    if (!uploadFn) return false;
                    handleVideoUpload(view, file, uploadFn);
                  }
                  return true;
                },
                handleDrop(view, event, _slice, moved) {
                  if (moved) return false;
                  const files = Array.from(
                    (event as DragEvent).dataTransfer?.files ?? [],
                  );
                  const mediaFiles = files.filter((f) => isImageFile(f) || isVideoFile(f));
                  if (mediaFiles.length === 0) return false;
                  
                  (event as DragEvent).preventDefault();
                  const pos = view.posAtCoords({
                    left: (event as DragEvent).clientX,
                    top: (event as DragEvent).clientY,
                  });
                  for (const file of mediaFiles) {
                    if (isImageFile(file)) {
                      const uploadFn = onUploadImageRef.current;
                      if (!uploadFn) continue;
                      handleImageUpload(view, file, uploadFn, pos?.pos);
                    } else {
                      const uploadFn = onUploadVideoRef.current;
                      if (!uploadFn) continue;
                      handleVideoUpload(view, file, uploadFn, pos?.pos);
                    }
                  }
                  return true;
                },
              },
            }),
          ];
        },
      }),
    ],

    content: value ?? "",
    editable: !disabled && !isLocked,
    immediatelyRender: false,

    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getJSON() as Record<string, unknown>);
    },
    onFocus: () => onFocus?.(),
    onBlur: () => onBlur?.(),

    editorProps: {
      attributes: {
        class: "tiptap",
        spellcheck: "true",
      },
    },
  });

  // ── Sync external value → editor ──────────────────────────────────────────
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(value);
    if (current === incoming) return;
    editor.commands.setContent(value ?? "", false);
  }, [editor, value]);

  // ── Sync editable ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && !isLocked);
  }, [editor, disabled, isLocked]);

  // ── Block options (needs live editor) ─────────────────────────────────────
  const liveBlockOptions = useBlockOptions(editor, onUploadImage, onUploadVideo, triggerImageFileInput, triggerVideoFileInput, requestUrl);

  // ── Link BubbleMenu ───────────────────────────────────────────────────────
  const [editingLink, setEditingLink] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState("");

  const applyLink = useCallback(() => {
    const safe = normalizeUrl(linkInputUrl);
    if (safe) {
      editor?.chain().focus().setLink({ href: safe, target: "_blank" }).run();
    } else if (!linkInputUrl.trim()) {
      editor?.chain().focus().unsetLink().run();
    }
    setEditingLink(false);
    setLinkInputUrl("");
  }, [editor, linkInputUrl]);

  return (
    <div className="relative">
      <style suppressHydrationWarning>{EDITOR_STYLES}</style>

      {isLocked && (
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          {lockHint ?? "Otro usuario está editando este contenido."}
        </p>
      )}

      {/* Hidden file input for manual image selection */}
      {onUploadImage && !disabled && !isLocked && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !editor) return;
              e.target.value = "";

              const error = validateImageFile(file);
              if (error) {
                const { default: toast } = await import("react-hot-toast");
                toast.error(error);
                return;
              }

              setIsUploading(true);
              try {
                handleImageUpload(editor.view, file, onUploadImage);
              } finally {
                setIsUploading(false);
              }
            }}
          />
          <input
            ref={videoFileInputRef}
            type="file"
            accept={ALLOWED_VIDEO_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !editor) return;
              e.target.value = "";

              const error = validateVideoFile(file);
              if (error) {
                const { default: toast } = await import("react-hot-toast");
                toast.error(error);
                return;
              }

              setIsUploading(true);
              try {
                handleVideoUpload(editor.view, file, onUploadVideo!);
              } finally {
                setIsUploading(false);
              }
            }}
          />
        </>
      )}

      {/* Upload indicator */}
      {isUploading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
          Subiendo imagen...
        </div>
      )}

      {/*
        ── Editor wrapper ─────────────────────────────────────────────────────
        `position: relative` is required so that BlockControls (position: absolute)
        are correctly anchored to the text area — not the viewport.
        `pl-14 sm:pl-16` reserves space for the +/grip buttons on the left.
      */}
      <div
        ref={wrapperRef}
        className={cn(
          "tf-editor relative cursor-text",
          // En móvil no hay columna de controles +/⠿ (BlockControls muestra
          // un FAB), así que no reservamos ese padding izquierdo.
          "pl-0 sm:pl-16",
          disabled && "pointer-events-none opacity-60"
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget && editor) {
            editor.commands.focus("end");
          }
        }}
      >
        {/* Block controls (absolute, relative to this wrapper) */}
        {editor && !disabled && !isLocked && (
          <BlockControls
            editor={editor}
            wrapperRef={wrapperRef}
            blockOptions={liveBlockOptions}
            triggerImageFileInput={triggerImageFileInput}
            disabled={disabled || isLocked}
          />
        )}

        <EditorContent editor={editor} />

        {editor && !disabled && !isLocked && editor.storage.characterCount ? (
          <p className="mt-2 select-none text-right text-[11px] text-zinc-400 dark:text-zinc-600">
            {editor.storage.characterCount.words()} palabras ·{" "}
            {editor.storage.characterCount.characters()} caracteres
          </p>
        ) : null}
      </div>

      {/* ── Slash command menu ────────────────────────────────────────────── */}
      <SlashCommandMenu
        items={slashMenuState.items}
        command={slashMenuState.command}
        clientRect={slashMenuState.clientRect}
        isVisible={slashMenuState.isVisible}
        keyDownHandlerRef={slashKeyDownRef}
        container={
          (editor?.view.dom.closest("[data-slot='dialog-content']") as HTMLElement | null) ??
          (typeof document !== "undefined" ? document.body : null)
        }
        onDismiss={() => setSlashMenuState((prev) => ({ ...prev, isVisible: false }))}
      />

      {/* Diálogo para pedir URL (reemplaza window.prompt) */}
      {urlPromptDialog}

      {/* ── BubbleMenu de tabla ──────────────────────────────────────────── */}
      {editor && (
        <BubbleMenu
          editor={editor}
          pluginKey="tableBubble"
          tippyOptions={{ duration: 100, placement: "top" }}
          shouldShow={({ editor: e }) => e.isActive("table")}
          className="flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white p-1 text-xs shadow-xl dark:border-zinc-700 dark:bg-zinc-900 z-50"
        >
          {[
            { icon: Columns3, label: "Columna +", run: () => editor.chain().focus().addColumnAfter().run() },
            { icon: Columns3, label: "Columna −", run: () => editor.chain().focus().deleteColumn().run() },
            { icon: Rows3, label: "Fila +", run: () => editor.chain().focus().addRowAfter().run() },
            { icon: Rows3, label: "Fila −", run: () => editor.chain().focus().deleteRow().run() },
          ].map(({ icon: Icon, label, run }) => (
            <button
              key={label}
              type="button"
              title={label}
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={run}
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
          <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <button
            type="button"
            title="Eliminar tabla"
            aria-label="Eliminar tabla"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </BubbleMenu>
      )}

      {/* ── BubbleMenu: formato de texto + edición de enlace ──────────────── */}
      {editor && (
        <BubbleMenu
          editor={editor}
          pluginKey="formatBubble"
          tippyOptions={{ duration: 100, placement: "top", maxWidth: 480 }}
          shouldShow={({ editor: e, state, from, to }) => {
            if (e.isActive("link")) return true;
            // Selección de texto no vacía y no dentro de un bloque de código.
            if (from === to) return false;
            if (e.isActive("codeBlock")) return false;
            return !state.doc.textBetween(from, to).trim().length ? false : true;
          }}
          className="flex items-center gap-0.5 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 z-50"
        >
          {!editingLink && !editor.isActive("link") ? (
            <div className="flex items-center gap-0.5">
              {[
                { icon: BoldIcon, label: "Negrita", is: "bold", run: () => editor.chain().focus().toggleBold().run() },
                { icon: ItalicIcon, label: "Cursiva", is: "italic", run: () => editor.chain().focus().toggleItalic().run() },
                { icon: UnderlineIcon, label: "Subrayado", is: "underline", run: () => editor.chain().focus().toggleUnderline().run() },
                { icon: StrikethroughIcon, label: "Tachado", is: "strike", run: () => editor.chain().focus().toggleStrike().run() },
                { icon: InlineCodeIcon, label: "Código", is: "code", run: () => editor.chain().focus().toggleCode().run() },
                { icon: HighlighterIcon, label: "Resaltar", is: "highlight", run: () => editor.chain().focus().toggleHighlight().run() },
              ].map(({ icon: Icon, label, is, run }) => (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  aria-pressed={editor.isActive(is)}
                  title={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={run}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    editor.isActive(is)
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
              {[
                { icon: AlignLeft, label: "Alinear a la izquierda", value: "left" },
                { icon: AlignCenter, label: "Centrar", value: "center" },
                { icon: AlignRight, label: "Alinear a la derecha", value: "right" },
              ].map(({ icon: Icon, label, value }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={editor.isActive({ textAlign: value })}
                  title={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => editor.chain().focus().setTextAlign(value).run()}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    editor.isActive({ textAlign: value })
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
              <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
              <button
                type="button"
                aria-label="Añadir enlace"
                title="Añadir enlace"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setLinkInputUrl("");
                  setEditingLink(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
            </div>
          ) : editingLink ? (
            <div className="flex items-center gap-2 p-1">
              <Input
                autoFocus
                type="url"
                value={linkInputUrl}
                onChange={(e) => setLinkInputUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyLink();
                  if (e.key === "Escape") setEditingLink(false);
                }}
                className="w-64 h-8"
                placeholder="https://..."
              />
              <Button
                onClick={applyLink}
                size="sm"
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Guardar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 p-1">
              <a
                href={editor.getAttributes("link").href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 max-w-[200px] truncate px-3 py-1.5 text-sm text-blue-600 hover:bg-zinc-100 dark:text-blue-400 dark:hover:bg-zinc-800 rounded-md transition"
              >
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span className="truncate">{editor.getAttributes("link").href}</span>
              </a>
              <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLinkInputUrl(editor.getAttributes("link").href || "");
                  setEditingLink(true);
                }}
                className="h-7 w-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition rounded-md"
                title="Editar enlace"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().unsetLink().run()}
                className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300 transition rounded-md"
                title="Eliminar enlace"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </BubbleMenu>
      )}
    </div>
  );
}
