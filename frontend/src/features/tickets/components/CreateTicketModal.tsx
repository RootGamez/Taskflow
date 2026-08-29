import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckSquare2,
  ChevronDown,
  Code2,
  Heading2,
  Heading3,
  ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Ticket,
  Video as VideoIcon,
  X,
} from "lucide-react";
import {
  EditorContent,
  Extension,
  type Editor,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Dropcursor from "@tiptap/extension-dropcursor";
import { Plugin, PluginKey } from "@tiptap/pm/state";

import { Button } from "@/components/ui/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/shadcn/dialog";
import { TicketAssigneeSelect } from "./TicketAssigneeSelect";
import { TicketCalendarPicker } from "./TicketCalendarPicker";
import { DEFAULT_TICKET_DESCRIPTION } from "@/features/tickets/lib/defaultTicketTemplate";
import { TicketTemplatePicker, type AppliedTicketTemplate } from "@/features/ticket-templates/components/TicketTemplatePicker";
import { BUILT_IN_TEMPLATE_ID } from "@/features/ticket-templates/lib/builtInTemplate";
import type { Priority } from "@/features/tickets/types/ticket.types";
import { SlashExtension, type SlashCommandItem } from "./extensions/SlashExtension";
import {
  SlashCommandMenu,
  createSlashMenuRenderer,
  type SlashMenuReactState,
} from "./editor/SlashCommandMenu";
import { BlockControls } from "./editor/BlockControls";

// ─── Priority config ───────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: Array<{
  value: Priority;
  label: string;
  icon: typeof Minus;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    value: "urgent",
    label: "Urgente",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-900",
  },
  {
    value: "high",
    label: "Alta",
    icon: ArrowUp,
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200 dark:border-orange-800",
  },
  {
    value: "medium",
    label: "Media",
    icon: Minus,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
  {
    value: "low",
    label: "Baja",
    icon: ArrowDown,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    value: "none",
    label: "Sin prioridad",
    icon: Minus,
    color: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-50 dark:bg-zinc-900/50",
    border: "border-zinc-200 dark:border-zinc-700",
  },
];

// ─── File type helpers ─────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50; // tighter limit for base64 in creation

function isImageFile(f: File) { return ALLOWED_IMAGE_TYPES.includes(f.type); }
function isVideoFile(f: File) { return ALLOWED_VIDEO_TYPES.includes(f.type); }

/** Convert file to base64 data URL (used during ticket creation before we have an ID) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function insertImageAsBase64(view: Editor["view"], file: File) {
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    const { default: toast } = await import("react-hot-toast");
    toast.error(`La imagen supera el límite de ${MAX_IMAGE_MB} MB.`);
    return;
  }
  const { default: toast } = await import("react-hot-toast");
  const id = toast.loading("Cargando imagen...");
  try {
    const dataUrl = await fileToDataUrl(file);
    const imageNodeType = view.state.schema.nodes.image;
    if (!imageNodeType) return;
    const node = imageNodeType.create({ src: dataUrl, alt: file.name });
    const { tr } = view.state;
    tr.insert(view.state.selection.to, node);
    view.dispatch(tr);
    toast.dismiss(id);
  } catch {
    toast.dismiss(id);
    toast.error("No se pudo cargar la imagen.");
  }
}

async function insertVideoAsBase64(view: Editor["view"], file: File) {
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    const { default: toast } = await import("react-hot-toast");
    toast.error(`El video supera el límite de ${MAX_VIDEO_MB} MB para creación.`);
    return;
  }
  const videoNodeType = view.state.schema.nodes.video;
  if (!videoNodeType) {
    // Fallback: insert as link
    const { default: toast } = await import("react-hot-toast");
    toast("Video no soportado en el editor de creación.", { icon: "⚠️" });
    return;
  }
  const { default: toast } = await import("react-hot-toast");
  const id = toast.loading("Cargando video...");
  try {
    const dataUrl = await fileToDataUrl(file);
    const node = videoNodeType.create({ src: dataUrl });
    const { tr } = view.state;
    tr.insert(view.state.selection.to, node);
    view.dispatch(tr);
    toast.dismiss(id);
  } catch {
    toast.dismiss(id);
    toast.error("No se pudo cargar el video.");
  }
}

// ─── Editor styles ─────────────────────────────────────────────────────────────

const MODAL_EDITOR_STYLES = `
.ctm-editor .tiptap {
  outline: none;
  min-height: 280px;
  max-height: 440px;
  overflow-y: auto;
  padding: 0 2px;
  font-size: 14px;
  line-height: 1.75;
  color: #1c1c1e;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}
.dark .ctm-editor .tiptap { color: #f4f4f5; scrollbar-color: #3f3f46 transparent; }

.ctm-editor .tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: #a1a1aa;
  float: left;
  height: 0;
  pointer-events: none;
}

.ctm-editor .tiptap p { margin: 0 0 0.25rem 0; }

.ctm-editor .tiptap h2 {
  font-size: 1.1rem; font-weight: 700; line-height: 1.3;
  margin: 1.25rem 0 0.4rem;
  color: #111827;
}
.dark .ctm-editor .tiptap h2 { color: #f9fafb; }

.ctm-editor .tiptap h3 {
  font-size: 0.95rem; font-weight: 600; line-height: 1.4;
  margin: 1rem 0 0.35rem; color: #1f2937;
}
.dark .ctm-editor .tiptap h3 { color: #f3f4f6; }

.ctm-editor .tiptap ul, .ctm-editor .tiptap ol {
  margin: 0.25rem 0 0.5rem 1.25rem; padding: 0;
}
.ctm-editor .tiptap ul { list-style-type: disc; }
.ctm-editor .tiptap ol { list-style-type: decimal; }
.ctm-editor .tiptap li { margin: 0.1rem 0; }
.ctm-editor .tiptap li > p { margin: 0; }

/* Task list */
.ctm-editor .tiptap ul[data-type="taskList"] { list-style: none; margin-left: 0; }
.ctm-editor .tiptap ul[data-type="taskList"] li {
  display: flex; align-items: flex-start; gap: 0.5rem; margin: 0.25rem 0;
}
.ctm-editor .tiptap ul[data-type="taskList"] li > label { flex-shrink: 0; margin-top: 0.2rem; }
.ctm-editor .tiptap ul[data-type="taskList"] input[type="checkbox"] {
  width: 1rem; height: 1rem; cursor: pointer; accent-color: #7c3aed; border-radius: 3px;
}
.ctm-editor .tiptap ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through; color: #9ca3af;
}

.ctm-editor .tiptap blockquote {
  border-left: 3px solid #e4e4e7; padding-left: 0.875rem; margin: 0.5rem 0;
  color: #71717a; font-style: italic;
}
.dark .ctm-editor .tiptap blockquote { border-left-color: #3f3f46; color: #a1a1aa; }

.ctm-editor .tiptap code {
  background: #f4f4f5; border-radius: 0.25rem; padding: 0.1em 0.35em;
  font-family: ui-monospace, monospace; font-size: 0.82em; color: #dc2626;
}
.dark .ctm-editor .tiptap code { background: #27272a; color: #f87171; }

.ctm-editor .tiptap pre {
  background: #18181b; border-radius: 0.5rem; padding: 0.75rem 1rem; margin: 0.5rem 0; overflow-x: auto;
}
.ctm-editor .tiptap pre code { background: none; color: #e4e4e7; padding: 0; font-size: 0.8rem; }

.ctm-editor .tiptap a { color: #2563eb; text-decoration: underline; text-underline-offset: 2px; }
.ctm-editor .tiptap img { max-width: 100%; border-radius: 0.5rem; margin: 0.5rem 0; }
.ctm-editor .tiptap video { max-width: 100%; border-radius: 0.5rem; margin: 0.5rem 0; }
.ctm-editor .tiptap hr { border: none; border-top: 1px solid #e4e4e7; margin: 1rem 0; }
.dark .ctm-editor .tiptap hr { border-top-color: #3f3f46; }
.ctm-editor .tiptap ::selection { background: #ddd6fe; }
.dark .ctm-editor .tiptap ::selection { background: #4c1d9540; }
.ctm-editor .tiptap .suggestion { color: #a1a1aa; }
`;

// ─── Block options (no-upload version for creation — uses base64) ──────────────

function useBlockOptions(
  editor: Editor | null,
  triggerImage: () => void,
  triggerVideo: () => void,
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
        description: "Bloque de código",
        group: "advanced",
        keywords: ["code", "codigo", "snippet", "bloque", "pre"],
        icon: Code2,
        apply: (e) => e.chain().focus().toggleCodeBlock().run(),
      },
      {
        id: "link",
        label: "Enlace",
        description: "Insertar un link",
        group: "advanced",
        keywords: ["link", "enlace", "url", "href"],
        icon: LinkIcon,
        apply: (e) => {
          const url = window.prompt("URL del enlace:");
          if (url) e.chain().focus().setLink({ href: url, target: "_blank" }).run();
        },
      },
      {
        id: "image",
        label: "Imagen",
        description: "Sube una imagen desde tu equipo",
        group: "media",
        keywords: ["imagen", "foto", "image", "picture", "img", "upload"],
        icon: ImageIcon,
        apply: () => { triggerImage(); },
      },
      {
        id: "video",
        label: "Video",
        description: "Sube un video (MP4, WebM, MOV...)",
        group: "media",
        keywords: ["video", "mp4", "webm", "mov", "clip", "upload"],
        icon: VideoIcon,
        apply: () => { triggerVideo(); },
      },
    ];
  }, [editor, triggerImage, triggerVideo]);
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CreateTicketInput {
  title: string;
  priority: Priority;
  due_date: string | null;
  description?: Record<string, unknown>;
  assignee_ids?: string[];
  // D20 de docs/PHASE_4_PLAN.md: solo el checklist de la plantilla se
  // aplica en el servidor -- titulo/descripcion/prioridad ya viajan como
  // campos normales, prefijados en el cliente por `handleApplyTemplate`.
  template_id?: string;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  columnName?: string;
  onClose: () => void;
  onCreate: (input: CreateTicketInput) => Promise<void>;
}

// ─── Priority dropdown ─────────────────────────────────────────────────────────

function PriorityDropdown({
  value,
  onChange,
  disabled,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = PRIORITY_OPTIONS.find((o) => o.value === value)!;
  const ActiveIcon = active.icon;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all hover:brightness-95 ${active.color} ${active.bg} ${active.border}`}
      >
        <ActiveIcon className="h-3.5 w-3.5" />
        {active.label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {PRIORITY_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${isActive ? "font-semibold" : ""} ${opt.color}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {opt.label}
                {isActive && <span className="ml-auto text-[10px] opacity-60">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreateTicketModal({
  isOpen,
  isLoading = false,
  columnName,
  onClose,
  onCreate,
}: CreateTicketModalProps) {
  // Autosuficiente (D4 de docs/PHASE_4_PLAN.md): el modal solo se monta
  // bajo /workspaces/:workspaceSlug/projects/:projectId/*, asi que lee su
  // propio `projectId` de la ruta en vez de recibirlo como prop nueva.
  const { projectId = "" } = useParams();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ── Slash menu state ───────────────────────────────────────────────────────
  const [slashMenuState, setSlashMenuState] = useState<SlashMenuReactState>({
    items: [],
    command: () => {},
    clientRect: null,
    isVisible: false,
  });
  const slashKeyDownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null);

  // ── File triggers ──────────────────────────────────────────────────────────
  const triggerImage = useCallback(() => imageInputRef.current?.click(), []);
  const triggerVideo = useCallback(() => videoInputRef.current?.click(), []);

  // ── Slash renderer (stable) ────────────────────────────────────────────────
  const slashRenderer = useMemo(
    () => createSlashMenuRenderer(setSlashMenuState, slashKeyDownRef),
    []
  );

  // ── Block options (uses base64 uploads) ───────────────────────────────────
  const blockOptions = useBlockOptions(null, triggerImage, triggerVideo);

  // ── Tiptap editor ──────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, dropcursor: false }),

      Image.configure({ inline: false, allowBase64: true }),

      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: {
          class: "cursor-pointer font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 underline underline-offset-2",
        },
      }),

      Placeholder.configure({
        placeholder: "Escribe algo, o presiona '/' para insertar un bloque...",
        emptyEditorClass: "is-editor-empty",
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
      }),

      Dropcursor.configure({ color: "#7c3aed", width: 2 }),
      TaskList,
      TaskItem.configure({ nested: true }),

      // ── Slash command ("/") ──────────────────────────────────────────────
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
            if (props.id === "image") triggerImage();
            if (props.id === "video") triggerVideo();
          },
        },
      }),

      // ── Paste & drop media ───────────────────────────────────────────────
      Extension.create({
        name: "ctmMediaUpload",
        addProseMirrorPlugins() {
          return [
            new Plugin({
              key: new PluginKey("ctmMediaUpload"),
              props: {
                handlePaste(view, event) {
                  const items = Array.from((event as ClipboardEvent).clipboardData?.items ?? []);
                  const file = items.find((i) => i.kind === "file")?.getAsFile();
                  if (!file || (!isImageFile(file) && !isVideoFile(file))) return false;
                  (event as ClipboardEvent).preventDefault();
                  if (isImageFile(file)) void insertImageAsBase64(view, file);
                  else void insertVideoAsBase64(view, file);
                  return true;
                },
                handleDrop(view, event, _slice, moved) {
                  if (moved) return false;
                  const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
                  const media = files.filter((f) => isImageFile(f) || isVideoFile(f));
                  if (media.length === 0) return false;
                  (event as DragEvent).preventDefault();
                  for (const file of media) {
                    if (isImageFile(file)) void insertImageAsBase64(view, file);
                    else void insertVideoAsBase64(view, file);
                  }
                  return true;
                },
              },
            }),
          ];
        },
      }),
    ],

    content: DEFAULT_TICKET_DESCRIPTION,
    editable: !isLoading,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "tiptap", spellcheck: "true" },
    },
  });

  // ── Live block options (with live editor ref) ──────────────────────────────
  const liveBlockOptions = useBlockOptions(editor, triggerImage, triggerVideo);

  // ── Reset on open/close ────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setPriority("none");
      setDueDate(null);
      setAssigneeIds([]);
      setTemplateId(undefined);
      editor?.commands.setContent(DEFAULT_TICKET_DESCRIPTION, false);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [isOpen, editor]);

  // ── Sync editable ──────────────────────────────────────────────────────────
  useEffect(() => {
    editor?.setEditable(!isLoading);
  }, [editor, isLoading]);

  // ── Apply a ticket template (D20 de docs/PHASE_4_PLAN.md) ──────────────────
  // Callback "hacia adentro" del propio modal (D4): TicketTemplatePicker es
  // un stub que hoy nunca la invoca, pero la firma queda fija para que WP-T
  // no tenga que volver a tocar este archivo.
  const handleApplyTemplate = useCallback((template: AppliedTicketTemplate) => {
    // Hallazgo de code-review (Fase 4A, HIGH): la plantilla "por defecto"
    // (BUILT_IN_TEMPLATE_ID) es solo un sentinel local, no una fila real
    // de la DB -- el backend valida `template_id` como UUID y rechaza
    // cualquier otra cosa con 400. Aplicarla debe seguir siendo identico
    // al comportamiento de hoy (D24): título/descripción/prioridad sí se
    // prefijan, pero NO se manda template_id al crear.
    setTemplateId(template.id === BUILT_IN_TEMPLATE_ID ? undefined : template.id);
    if (template.title_template) setTitle(template.title_template);
    setPriority(template.priority);
    if (template.description) {
      try {
        editor?.commands.setContent(JSON.parse(template.description), false);
      } catch {
        // RT-9: descripcion de plantilla con JSON invalido -- se ignora,
        // el editor conserva su contenido actual en vez de romper.
      }
    }
  }, [editor]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const description = editor?.getJSON() as Record<string, unknown> | undefined;
    await onCreate({
      title: trimmedTitle,
      priority,
      due_date: dueDate,
      description,
      assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
      template_id: templateId,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSubmit();
    if (e.key === "Escape") onClose();
  };

  const activePriority = PRIORITY_OPTIONS.find((o) => o.value === priority)!;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92vh] w-full max-w-[860px] flex-col gap-0 overflow-hidden rounded-2xl border border-zinc-200/80 p-0 shadow-2xl dark:border-zinc-800"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Nuevo ticket</DialogTitle>
          <DialogDescription>
            Formulario para crear un ticket con título, prioridad, fecha y contenido.
          </DialogDescription>
        </DialogHeader>

        <style suppressHydrationWarning>{MODAL_EDITOR_STYLES}</style>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !editor) return;
            e.target.value = "";
            await insertImageAsBase64(editor.view, file);
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={ALLOWED_VIDEO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !editor) return;
            e.target.value = "";
            await insertVideoAsBase64(editor.view, file);
          }}
        />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
            <Ticket className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nuevo ticket</p>
            {columnName && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Se creará en <span className="font-medium text-violet-600 dark:text-violet-400">{columnName}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: title + rich editor */}
          <div className="flex flex-1 flex-col overflow-hidden border-r border-zinc-100 dark:border-zinc-800">

            {/* Title */}
            <div className="px-6 pt-5 pb-2">
              <textarea
                ref={titleRef}
                id="ctm-title"
                value={title}
                rows={1}
                onChange={(e) => {
                  setTitle(e.target.value);
                  // Auto-grow
                  e.target.style.height = "auto";
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  // Prevent entering newlines in title
                  if (e.key === "Enter") {
                    e.preventDefault();
                  }
                }}
                placeholder="Escribe el título del ticket..."
                disabled={isLoading}
                className={
                  "w-full resize-none overflow-hidden bg-transparent outline-none " +
                  "text-[1.55rem] font-bold leading-tight tracking-tight " +
                  "text-zinc-900 dark:text-zinc-50 " +
                  "placeholder:text-zinc-300 placeholder:font-bold placeholder:tracking-tight dark:placeholder:text-zinc-600 " +
                  "transition-colors duration-150 " +
                  (isLoading ? "opacity-50 cursor-not-allowed" : "")
                }
                style={{ height: "auto" }}
              />
              {/* Animated underline */}
              <div className="mt-2 h-[2px] rounded-full bg-gradient-to-r from-violet-400 via-indigo-300 to-transparent opacity-60 dark:from-violet-600 dark:via-indigo-500 dark:to-transparent" />
            </div>

            {/* Rich editor with BlockControls */}
            <div
              ref={wrapperRef}
              className="ctm-editor relative flex-1 overflow-y-auto pl-14 pr-4 pb-4"
            >
              {/* BlockControls: floating + and grip */}
              {editor && !isLoading && (
                <BlockControls
                  editor={editor}
                  wrapperRef={wrapperRef}
                  blockOptions={liveBlockOptions}
                  disabled={isLoading}
                  triggerImageFileInput={triggerImage}
                />
              )}

              <EditorContent editor={editor} />

              {/* Slash command menu */}
              <SlashCommandMenu
                items={slashMenuState.items}
                command={slashMenuState.command}
                clientRect={slashMenuState.clientRect}
                isVisible={slashMenuState.isVisible}
                keyDownHandlerRef={slashKeyDownRef}
              />
            </div>
          </div>

          {/* Right: metadata sidebar */}
          <aside className="flex w-[220px] shrink-0 flex-col gap-5 overflow-y-auto bg-zinc-50/60 px-5 py-5 dark:bg-zinc-900/40">

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Plantilla
              </p>
              <TicketTemplatePicker
                projectId={projectId}
                onApply={handleApplyTemplate}
                disabled={isLoading}
                currentTitle={title}
              />
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Prioridad
              </p>
              <PriorityDropdown value={priority} onChange={setPriority} disabled={isLoading} />
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Fecha límite
              </p>
              <div className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5 text-zinc-400" />
                <TicketCalendarPicker value={dueDate} onChange={setDueDate} disabled={isLoading} />
              </div>
            </section>

            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Responsables
              </p>
              <TicketAssigneeSelect assigneeIds={assigneeIds} onChange={setAssigneeIds} disabled={isLoading} />
            </section>

            {/* Preview card */}
            <section className="mt-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
                Vista previa
              </p>
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {title.trim() || "Título del ticket"}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${activePriority.color} ${activePriority.bg} ${activePriority.border}`}>
                  {(() => { const Icon = activePriority.icon; return <Icon className="h-2.5 w-2.5" />; })()}
                  {activePriority.label}
                </span>
                {columnName && (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    {columnName}
                  </span>
                )}
              </div>
              {dueDate && (
                <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                  📅 {new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(dueDate))}
                </p>
              )}
              {assigneeIds.length > 0 && (
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                  👥 {assigneeIds.length} responsable{assigneeIds.length > 1 ? "s" : ""}
                </p>
              )}
            </section>
          </aside>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-zinc-100 bg-white/80 px-6 py-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono dark:border-zinc-700 dark:bg-zinc-800">⌘ Enter</kbd>
            {" "}para crear · <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 py-0.5 text-[10px] font-mono dark:border-zinc-700 dark:bg-zinc-800">/</kbd> para bloques
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isLoading || !title.trim()}
              className="gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:from-violet-700 hover:to-indigo-700"
            >
              {isLoading ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creando...
                </>
              ) : (
                <>
                  <Ticket className="h-3.5 w-3.5" />
                  Crear ticket
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
