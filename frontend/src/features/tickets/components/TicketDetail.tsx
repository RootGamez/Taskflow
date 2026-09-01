import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Select, SelectItem } from "@heroui/react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Minus, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import { Badge } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { TicketLabelsRow } from "@/features/labels/components/TicketLabelsRow";
import { TicketSprintsRow } from "@/features/sprints/components/TicketSprintsRow";
import { TicketRelationsSection } from "@/features/relations/components/TicketRelationsSection";
import { TicketDiscussion } from "@/features/tickets/components/TicketDiscussion";
import { LazyRichEditor } from "@/features/editor/LazyRichEditor";
import type {
  DocumentUploadFn,
  EditorAttachmentScope,
  ImageUploadFn,
} from "@/features/editor/RichEditor";
import type { MentionItem } from "@/features/editor/components/MentionList";
import { TicketSubtasksSection } from "@/features/subtasks/components/TicketSubtasksSection";
import { TicketAssigneeSelect } from "./TicketAssigneeSelect";
import { TicketCalendarPicker } from "./TicketCalendarPicker";
import { TicketDeleteDialog } from "./TicketDeleteDialog";
import { useCollaborativeField } from "../hooks/useCollaborativeField";
import { useDebounce } from "@/hooks/useDebounce";
import { getApiErrorMessage } from "@/lib/errors";
import type { Column } from "@/features/projects/types/project.types";
import type { Priority, Ticket } from "@/features/tickets/types/ticket.types";

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string; icon: typeof Minus }> = [
  { value: "urgent", label: "Urgente", icon: AlertTriangle },
  { value: "high", label: "Alta", icon: ArrowUp },
  { value: "medium", label: "Media", icon: Minus },
  { value: "low", label: "Baja", icon: ArrowDown },
  { value: "none", label: "Sin prioridad", icon: Minus },
];

interface TicketDraft {
  title: string;
  priority: Priority;
  due_date: string;
  column_id: string;
  description: string;
  assignees: string[];
}

type EditableField = keyof TicketDraft;
type CollaborativeField = EditableField | "progress_notes";
type FieldLockMap = Record<CollaborativeField, { userId: string; userName: string } | null>;
type RemoteLiveMap = Partial<Pick<TicketDraft, "title" | "description">> & { progress_notes?: string };

interface TicketPatchPayload {
  title: string;
  priority: Priority;
  due_date: string | null;
  column_id: string;
  description: string;
  assignee_ids?: string[];
}

interface TicketDetailProps {
  ticket: Ticket | null;
  isOpen: boolean;
  isLoading?: boolean;
  canEdit?: boolean;
  columns?: Column[];
  currentUserId?: string | null;
  fieldLocks?: FieldLockMap;
  remoteLiveValues?: RemoteLiveMap;
  /**
   * Enfoca y selecciona el campo de título al hidratar (creación instantánea,
   * docs/BRUTALIST_REDESIGN_PLAN.md §9): el usuario escribe encima del
   * placeholder "Ticket sin título" sin un clic extra.
   */
  autoFocusTitle?: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch?: (payload: Partial<TicketPatchPayload>) => Promise<void>;
  onLockField?: (field: CollaborativeField) => void;
  onUnlockField?: (field: CollaborativeField) => void;
  onTypingField?: (field: CollaborativeField, value: string) => void;
  onDelete?: () => Promise<void>;
  /** Función para subir imágenes al servidor desde el editor de contenido. */
  onUploadImage?: ImageUploadFn;
  /** Función para subir videos al servidor desde el editor de contenido. */
  onUploadVideo?: ImageUploadFn;
  /** Función para adjuntar documentos (PDF, Word, Excel...) desde el editor. */
  onUploadDocument?: DocumentUploadFn;
  /** Documento al que pertenece el editor, para descargar adjuntos. */
  attachmentScope?: EditorAttachmentScope | null;
  /** Miembros mencionables con `@` en el editor. */
  mentionItems?: MentionItem[];
}

function toDateInput(isoDate: string | null): string {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toApiDate(dateInput: string): string | null {
  if (!dateInput) return null;
  const parsed = new Date(`${dateInput}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeRichTextField(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value);
}

function parseRichTextJson(value: string): Record<string, unknown> | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }

    // Compatibilidad con contenido accidentalmente serializado dos veces.
    if (typeof parsed === "string") {
      try {
        const parsedTwice = JSON.parse(parsed);
        if (parsedTwice && typeof parsedTwice === "object") {
          return parsedTwice as Record<string, unknown>;
        }
      } catch {
        // Si el doble parse falla, lo dejamos caer al retorno final (legacy text).
      }
    }
  } catch {
    // Si JSON.parse falla, lo tratamos como texto legacy.
  }

  // Texto plano legacy: envolver en estructura compatible con ProseMirror para no perder contenido.
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: normalized }],
      },
    ],
  };
}

function buildDraft(ticket: Ticket): TicketDraft {
  const rawDescription = normalizeRichTextField(ticket.description).trim();
  const progressNotes = normalizeRichTextField(ticket.progress_notes).trim();
  let mergedDescription = rawDescription;

  const isProbablyJson = rawDescription.startsWith("{") || rawDescription.startsWith('"{');

  // Backward compatibility: solo fusionar cuando es texto plano legacy.
  if (!isProbablyJson && rawDescription) {
    mergedDescription = [rawDescription, progressNotes]
      .filter((segment): segment is string => Boolean(segment))
      .join("\n\n");
  }

  return {
    title: ticket.title,
    priority: ticket.priority,
    due_date: toDateInput(ticket.due_date),
    column_id: ticket.column_id,
    description: mergedDescription,
    // Sort IDs for consistent set comparison — server may return them in any order
    assignees: (ticket.assignees?.map(a => a.id) || []).slice().sort(),
  };
}

function toPatchPayload(draft: TicketDraft): TicketPatchPayload {
  return {
    title: draft.title.trim(),
    priority: draft.priority,
    due_date: toApiDate(draft.due_date),
    column_id: draft.column_id,
    description: draft.description,
    assignee_ids: draft.assignees,
  };
}

function getDiff(prev: TicketPatchPayload, next: TicketPatchPayload): Partial<TicketPatchPayload> {
  const payload: Partial<TicketPatchPayload> = {};

  if (prev.title !== next.title && next.title.trim().length > 0) payload.title = next.title.trim();
  if (prev.priority !== next.priority) payload.priority = next.priority;
  if (prev.due_date !== next.due_date) payload.due_date = next.due_date;
  if (prev.column_id !== next.column_id && next.column_id) payload.column_id = next.column_id;
  if (prev.description !== next.description) {
    payload.description = next.description;
  }
  // Compare as sorted sets to avoid false positives from server returning IDs in different order
  const prevIds = (prev.assignee_ids ?? []).slice().sort().join(",");
  const nextIds = (next.assignee_ids ?? []).slice().sort().join(",");
  if (prevIds !== nextIds) {
    payload.assignee_ids = next.assignee_ids;
  }

  return payload;
}

type DraftAction =
  | { type: "HYDRATE"; ticket: Ticket }
  | { type: "MERGE"; value: Partial<TicketDraft> }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_PRIORITY"; value: Priority }
  | { type: "SET_COLUMN"; value: string }
  | { type: "SET_DUE_DATE"; value: string }
  | { type: "SET_DESCRIPTION"; value: string }
  | { type: "SET_ASSIGNEES"; value: string[] };

const initialDraft: TicketDraft = {
  title: "",
  priority: "none",
  due_date: "",
  column_id: "",
  description: "",
  assignees: [],
};

function draftReducer(state: TicketDraft, action: DraftAction): TicketDraft {
  switch (action.type) {
    case "HYDRATE":
      return buildDraft(action.ticket);
    case "MERGE":
      return { ...state, ...action.value };
    case "SET_TITLE":
      return { ...state, title: action.value };
    case "SET_PRIORITY":
      return { ...state, priority: action.value };
    case "SET_COLUMN":
      return { ...state, column_id: action.value };
    case "SET_DUE_DATE":
      return { ...state, due_date: action.value };
    case "SET_DESCRIPTION":
      return { ...state, description: action.value };
    case "SET_ASSIGNEES":
      return { ...state, assignees: action.value.slice().sort() };
    default:
      return state;
  }
}

export function TicketDetail({
  ticket,
  isOpen,
  isLoading = false,
  canEdit = true,
  columns = [],
  currentUserId = null,
  fieldLocks = {
    title: null,
    priority: null,
    due_date: null,
    column_id: null,
    description: null,
    progress_notes: null,
    assignees: null,
  },
  remoteLiveValues,
  autoFocusTitle = false,
  onOpenChange,
  onPatch,
  onLockField,
  onUnlockField,
  onTypingField,
  onDelete,
  onUploadImage,
  onUploadVideo,
  onUploadDocument,
  attachmentScope,
  mentionItems,
}: TicketDetailProps) {
  const [draftState, dispatch] = useReducer(draftReducer, initialDraft);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [immediateSaveNonce, setImmediateSaveNonce] = useState(0);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { title, priority, due_date, column_id, description, assignees } = draftState;
  const hydratedTicketIdRef = useRef<string | null>(null);
  const activeFieldRef = useRef<CollaborativeField | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const pendingFieldsRef = useRef<Set<EditableField>>(new Set());
  const lastSyncedRef = useRef<TicketPatchPayload | null>(null);
  const flushInFlightRef = useRef(false);
  const queuedDraftRef = useRef<TicketPatchPayload | null>(null);
  const dialogContentRef = useRef<HTMLDivElement | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoFocusedTitleForRef = useRef<string | null>(null);

  // Auto-size the title textarea when value changes externally (hydration, remote)
  useEffect(() => {
    const el = titleTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const markFieldPending = (field: EditableField) => {
    pendingFieldsRef.current.add(field);
  };

  const markLocalChange = (field: EditableField) => {
    markFieldPending(field);
    setHasLocalChanges(true);
  };

  const clearPendingIfSynced = (serverDraft: TicketPatchPayload) => {
    const pending = pendingFieldsRef.current;

    if (pending.has("title") && serverDraft.title === title.trim()) {
      pending.delete("title");
    }

    if (pending.has("priority") && serverDraft.priority === priority) {
      pending.delete("priority");
    }

    if (pending.has("column_id") && serverDraft.column_id === column_id) {
      pending.delete("column_id");
    }

    if (pending.has("due_date") && toDateInput(serverDraft.due_date) === due_date) {
      pending.delete("due_date");
    }

    if (pending.has("description") && serverDraft.description === description) {
      pending.delete("description");
    }

    if (pending.has("assignees")) {
      const serverIds = (serverDraft.assignee_ids ?? []).slice().sort().join(",");
      const localIds = assignees.slice().sort().join(",");
      if (serverIds === localIds) {
        pending.delete("assignees");
      }
    }

  };

  const hasRemoteTitle = Boolean(
    remoteLiveValues &&
      Object.prototype.hasOwnProperty.call(remoteLiveValues, "title") &&
      typeof remoteLiveValues.title === "string",
  );

  const hasRemoteDescription = Boolean(
    remoteLiveValues &&
      (Object.prototype.hasOwnProperty.call(remoteLiveValues, "description") ||
        Object.prototype.hasOwnProperty.call(remoteLiveValues, "progress_notes")),
  );

  const remoteDescription = hasRemoteDescription
    ? Object.prototype.hasOwnProperty.call(remoteLiveValues, "description")
      ? normalizeRichTextField(remoteLiveValues?.description)
      : normalizeRichTextField(remoteLiveValues?.progress_notes)
    : undefined;

  const titleField = useCollaborativeField<string, CollaborativeField>({
    field: "title",
    value: title,
    setValue: (value) => dispatch({ type: "SET_TITLE", value }),
    isOpen,
    currentUserId,
    lock: fieldLocks.title,
    activeFieldRef,
    onLockField,
    onUnlockField,
    hasRemoteValue: hasRemoteTitle,
    remoteValue: remoteLiveValues?.title,
    onBeforeApplyRemote: () => {
      skipNextAutosaveRef.current = true;
    },
  });

  const priorityField = useCollaborativeField<Priority, CollaborativeField>({
    field: "priority",
    value: priority,
    setValue: (value) => dispatch({ type: "SET_PRIORITY", value }),
    isOpen,
    currentUserId,
    lock: fieldLocks.priority,
    activeFieldRef,
    onLockField,
    onUnlockField,
  });

  const columnField = useCollaborativeField<string, CollaborativeField>({
    field: "column_id",
    value: column_id,
    setValue: (value) => dispatch({ type: "SET_COLUMN", value }),
    isOpen,
    currentUserId,
    lock: fieldLocks.column_id,
    activeFieldRef,
    onLockField,
    onUnlockField,
  });

  const dueDateField = useCollaborativeField<string, CollaborativeField>({
    field: "due_date",
    value: due_date,
    setValue: (value) => dispatch({ type: "SET_DUE_DATE", value }),
    isOpen,
    currentUserId,
    lock: fieldLocks.due_date,
    activeFieldRef,
    onLockField,
    onUnlockField,
  });

  const descriptionField = useCollaborativeField<string, CollaborativeField>({
    field: "description",
    value: description,
    setValue: (value) => dispatch({ type: "SET_DESCRIPTION", value }),
    isOpen,
    currentUserId,
    lock: fieldLocks.description,
    activeFieldRef,
    onLockField,
    onUnlockField,
    hasRemoteValue: hasRemoteDescription,
    remoteValue: remoteDescription,
    onBeforeApplyRemote: () => {
      skipNextAutosaveRef.current = true;
    },
  });

  useEffect(() => {
    if (!ticket || !isOpen) {
      setIsHydrated(false);
      setHasLocalChanges(false);
      hydratedTicketIdRef.current = null;
      const activeField = activeFieldRef.current;
      if (activeField) {
        onUnlockField?.(activeField);
      }
      activeFieldRef.current = null;
      dispatch({ type: "MERGE", value: initialDraft });
      return;
    }

    const serverDraft = buildDraft(ticket);
    const serverPayload = toPatchPayload(serverDraft);
    clearPendingIfSynced(serverPayload);

    const isSameTicket = hydratedTicketIdRef.current === ticket.id;
    const activeField = activeFieldRef.current;
    const isEditingTextField = activeField === "description" || activeField === "progress_notes";

    const canSyncField = (field: EditableField) => {
      if (!isSameTicket) return true;
      if (pendingFieldsRef.current.has(field)) return false;
      if (isEditingTextField && ["title", "priority", "due_date", "column_id"].includes(field)) {
        return false;
      }
      return activeField !== field;
    };

    if (!isSameTicket) {
      dispatch({ type: "HYDRATE", ticket });
    } else {
      const nextFromServer: Partial<TicketDraft> = {};
      if (canSyncField("title")) nextFromServer.title = serverDraft.title;
      if (canSyncField("priority")) nextFromServer.priority = serverDraft.priority;
      if (canSyncField("due_date")) nextFromServer.due_date = serverDraft.due_date;
      if (canSyncField("column_id")) nextFromServer.column_id = serverDraft.column_id;
      if (canSyncField("description")) nextFromServer.description = serverDraft.description;
      if (canSyncField("assignees")) nextFromServer.assignees = serverDraft.assignees;

      if (Object.keys(nextFromServer).length > 0) {
        dispatch({ type: "MERGE", value: nextFromServer });
      }
    }

    lastSyncedRef.current = serverPayload;

    if (!isSameTicket) {
      queuedDraftRef.current = null;
      flushInFlightRef.current = false;
      pendingFieldsRef.current.clear();
      skipNextAutosaveRef.current = true;
      setHasLocalChanges(false);
    }

    setIsHydrated(true);
    hydratedTicketIdRef.current = ticket.id;
  }, [isOpen, onUnlockField, ticket]);

  // Creación instantánea (§9): al abrir el detalle de un ticket recién
  // creado, se enfoca el título y se selecciona su texto para escribir
  // encima del placeholder sin un clic extra. Una sola vez por ticket.
  useEffect(() => {
    if (!autoFocusTitle || !isHydrated || !isOpen || !canEdit || !ticket) return;
    if (autoFocusedTitleForRef.current === ticket.id) return;
    const el = titleTextareaRef.current;
    if (!el || el.disabled) return;
    autoFocusedTitleForRef.current = ticket.id;
    el.focus();
    el.select();
  }, [autoFocusTitle, canEdit, isHydrated, isOpen, ticket]);

  const draft = useMemo<TicketPatchPayload>(() => toPatchPayload(draftState), [draftState]);

  const debouncedDraft = useDebounce(draft, 450);

  const scheduleImmediateSave = () => {
    setImmediateSaveNonce((value) => value + 1);
  };

  const flushDraft = useCallback(async () => {
    if (!ticket || !onPatch || !canEdit || !isOpen) {
      return;
    }

    if (flushInFlightRef.current) {
      return;
    }

    flushInFlightRef.current = true;

    let hasSaveError = false;
    let saveErrorMessage = "No se pudo guardar el ticket. Reintenta.";

    try {
      while (queuedDraftRef.current) {
        const candidate = queuedDraftRef.current;
        queuedDraftRef.current = null;

        const baseline = lastSyncedRef.current;
        if (!baseline) {
          continue;
        }

        const payload = getDiff(baseline, candidate);
        if (Object.keys(payload).length === 0) {
          continue;
        }

        try {
          await onPatch(payload);
          for (const key of Object.keys(payload)) {
            const pendingKey = key === "assignee_ids" ? "assignees" : key;
            pendingFieldsRef.current.delete(pendingKey as EditableField);
          }
          lastSyncedRef.current = {
            ...baseline,
            ...payload,
          };
        } catch (error) {
          hasSaveError = true;
          // p. ej. si el ticket/proyecto ya no existe o el acceso al
          // espacio se revoco entre que se abrio el detalle y se guardo
          // (backend responde 404 en vez de 500) -- mostrar el detalle
          // real en vez de un generico ayuda a distinguir "reintenta" de
          // "esto ya no es reintentable".
          saveErrorMessage = getApiErrorMessage(error, saveErrorMessage);
          queuedDraftRef.current = candidate;
          break;
        }
      }

      if (hasSaveError) {
        toast.error(saveErrorMessage);
        setHasLocalChanges(true);
      } else if (!queuedDraftRef.current) {
        setHasLocalChanges(false);
      }
    } finally {
      flushInFlightRef.current = false;
    }
  }, [canEdit, isOpen, onPatch, ticket]);

  useEffect(() => {
    if (!ticket || !canEdit || !onPatch || !isOpen || !isHydrated || !hasLocalChanges) {
      return;
    }

    const baseline = lastSyncedRef.current;
    if (!baseline) {
      return;
    }

    const diff = getDiff(baseline, debouncedDraft);
    if (Object.keys(diff).length === 0) {
      setHasLocalChanges(false);
      return;
    }

    // Evita flush de un draft antiguo cuando ya existe uno mas reciente en memoria.
    if (JSON.stringify(debouncedDraft) !== JSON.stringify(draft)) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    queuedDraftRef.current = debouncedDraft;
    void flushDraft();
  }, [canEdit, debouncedDraft, draft, flushDraft, hasLocalChanges, isHydrated, isOpen, onPatch, ticket]);

  useEffect(() => {
    if (!ticket || !canEdit || !onPatch || !isOpen || !isHydrated || !hasLocalChanges) {
      return;
    }

    if (immediateSaveNonce === 0) {
      return;
    }

    queuedDraftRef.current = draft;
    void flushDraft();
  }, [canEdit, draft, flushDraft, hasLocalChanges, immediateSaveNonce, isHydrated, isOpen, onPatch, ticket]);

  const isUnifiedEditorLocked = descriptionField.isLockedByOther;
  const unifiedEditorLockOwner = descriptionField.lockOwner;

  const shouldKeepDialogOpen = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest("[data-ticket-editor-floating='true']") ||
        target.closest("[role='listbox']") ||
        target.closest("[role='option']") ||
        target.closest("[data-slot='listbox']") ||
        target.closest("[data-slot='popover']"),
    );
  };

  const deleteKeyword = (ticket?.title ?? "").trim();
  const canConfirmDelete =
    deleteKeyword.length > 0 &&
    deleteConfirmation.trim().toLowerCase() === deleteKeyword.toLowerCase();

  const openDeleteDialog = () => {
    setDeleteConfirmation("");
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (isDeleting) {
      return;
    }

    setDeleteDialogOpen(false);
    setDeleteConfirmation("");
  };

  const confirmDelete = async () => {
    if (!onDelete || !canConfirmDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
      setDeleteDialogOpen(false);
      setDeleteConfirmation("");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogContentRef}
          showCloseButton={false}
          className="flex h-[100dvh] max-h-[100dvh] w-[94vw] max-w-6xl flex-col gap-0 overflow-hidden rounded border-2 border-border bg-card p-0 shadow-hard-lg dark:shadow-hard-float max-sm:w-full max-sm:max-w-none max-sm:rounded-none"
          onInteractOutside={(event) => {
            if (shouldKeepDialogOpen(event.target)) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (shouldKeepDialogOpen(event.target)) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del ticket</DialogTitle>
            <DialogDescription>
              Ventana para editar el ticket, sus responsables, prioridad, sprints y descripción.
            </DialogDescription>
          </DialogHeader>

          <div className="flex shrink-0 items-center justify-between border-b-2 border-border px-4 py-3 sm:px-10 sm:py-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {ticket?.reference ? (
                <Badge variant="outline" mono className="uppercase tracking-wider">
                  {ticket.reference}
                </Badge>
              ) : (
                <Badge variant="outline" mono className="uppercase tracking-wider">
                  #{ticket?.id?.slice(0, 8) ?? "---"}
                </Badge>
              )}
              {ticket?.project ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="boxed-icon h-3 w-3 shrink-0"
                    style={{ backgroundColor: ticket.project.color }}
                    aria-hidden
                  />
                  {ticket.project.name}
                </span>
              ) : null}
              {titleField.isLockedByOther && (
                <Badge variant="mustard" className="text-[10px]">
                  {fieldLocks.title?.userName} editando...
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canEdit && onDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={openDeleteDialog}
                  disabled={isLoading || isDeleting}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Eliminar
                </Button>
              ) : null}
              <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                <Check className="h-4 w-4" />
                <span>Guardado automático</span>
              </div>
              <DialogClose
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded border-2 border-transparent text-muted-foreground transition-[color,border-color,background-color] hover:border-border hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-5 w-5" />
              </DialogClose>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-10 sm:py-7 lg:px-14">
            <div className="mb-8 space-y-4">
            <div className="mb-2">
              <textarea
                ref={titleTextareaRef}
                id="ticket-title"
                value={title}
                rows={1}
                onChange={(event) => {
                  const next = event.target.value;
                  // Auto-grow
                  event.target.style.height = "auto";
                  event.target.style.height = `${event.target.scrollHeight}px`;
                  markLocalChange("title");
                  dispatch({ type: "SET_TITLE", value: next });
                  onTypingField?.("title", next);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                onFocus={titleField.onFocus}
                onBlur={titleField.onBlur}
                placeholder="Título del ticket"
                disabled={isLoading || !canEdit || titleField.isLockedByOther}
                className={
                  "w-full resize-none overflow-hidden bg-transparent outline-none " +
                  "font-display text-[1.55rem] font-bold leading-tight tracking-tight " +
                  "text-foreground " +
                  "placeholder:font-bold placeholder:tracking-tight placeholder:text-muted-foreground/50 " +
                  "transition-colors duration-150 " +
                  (isLoading || !canEdit || titleField.isLockedByOther ? "opacity-50 cursor-not-allowed" : "")
                }
                style={{ height: "auto" }}
              />
              <div className="mt-3 border-b-2 border-border" />
            </div>

            <div className="flex flex-col gap-3 py-4 text-sm">
              {/* Asignados */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span className="eyebrow sm:w-28">Responsables</span>
                <div className="flex-1">
                  <TicketAssigneeSelect
                    assigneeIds={assignees}
                    onChange={(ids) => {
                      markLocalChange("assignees");
                      dispatch({ type: "SET_ASSIGNEES", value: ids });
                      scheduleImmediateSave();
                    }}
                    disabled={isLoading || !canEdit}
                  />
                </div>
              </div>

              {/* Estado */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span className="eyebrow sm:w-28">Estado</span>
                <div className="flex-1">
                  <Select
                    aria-label="Estado"
                    selectionMode="single"
                    selectedKeys={
                      column_id && columns.some((column) => column.id === column_id)
                        ? new Set([column_id])
                        : new Set()
                    }
                    popoverProps={{ portalContainer: dialogContentRef.current ?? undefined }}
                    placeholder={columns.length === 0 ? "Sin columnas" : "Selecciona estado"}
                    onChange={(event) => {
                      const selectedColumn = event.target.value;
                      if (!selectedColumn) return;
                      markLocalChange("column_id");
                      dispatch({ type: "SET_COLUMN", value: selectedColumn });
                      scheduleImmediateSave();
                    }}
                    onFocus={columnField.onFocus}
                    onBlur={columnField.onBlur}
                    className="w-full sm:w-48"
                    classNames={{
                      trigger: "bg-card shadow-none border-2 border-border hover:bg-accent h-8 min-h-8 rounded-none text-xs data-[focus=true]:border-primary",
                      value: "text-xs font-medium"
                    }}
                    isDisabled={isLoading || !canEdit || columnField.isLockedByOther || columns.length === 0}
                  >
                    {columns.map((column) => (
                      <SelectItem key={column.id}>{column.name}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Prioridad */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span className="eyebrow sm:w-28">Prioridad</span>
                <div className="flex-1">
                  <Select
                    aria-label="Prioridad"
                    selectionMode="single"
                    selectedKeys={new Set([priority])}
                    popoverProps={{ portalContainer: dialogContentRef.current ?? undefined }}
                    onChange={(event) => {
                      const selectedPriority = (event.target.value || "none") as Priority;
                      markLocalChange("priority");
                      dispatch({ type: "SET_PRIORITY", value: selectedPriority });
                      scheduleImmediateSave();
                    }}
                    onFocus={priorityField.onFocus}
                    onBlur={priorityField.onBlur}
                    className="w-full sm:w-48"
                    classNames={{
                      trigger: "bg-card shadow-none border-2 border-border hover:bg-accent h-8 min-h-8 rounded-none text-xs data-[focus=true]:border-primary",
                      value: "text-xs font-medium"
                    }}
                    isDisabled={isLoading || !canEdit || priorityField.isLockedByOther}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Fecha Limite */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span className="eyebrow sm:w-28">Fecha límite</span>
                <div className="flex-1">
                  <TicketCalendarPicker
                    value={due_date ? new Date(`${due_date}T00:00:00Z`).toISOString() : null}
                    onChange={(isoDate) => {
                      markLocalChange("due_date");
                      const simpleDate = isoDate ? isoDate.split("T")[0] : "";
                      dispatch({ type: "SET_DUE_DATE", value: simpleDate });
                      scheduleImmediateSave();
                    }}
                    disabled={isLoading || !canEdit || dueDateField.isLockedByOther}
                  />
                </div>
              </div>

              {/* Sprints: mismo patrón autosuficiente que Labels. Un ticket
                  puede estar en varios sprints a la vez (arrastre). */}
              {ticket ? (
                <TicketSprintsRow
                  ticketId={ticket.id}
                  projectId={ticket.project_id}
                  sprintIds={ticket.sprint_ids ?? []}
                  canEdit={Boolean(canEdit)}
                />
              ) : null}

              {/* Labels: autosuficiente (D43) — llama sus propios hooks en vez de
                  props propagadas desde TicketDetail. Fuera del pipeline de
                  draft/autosave a proposito (D44). */}
              {ticket ? (
                <TicketLabelsRow
                  ticketId={ticket.id}
                  projectId={ticket.project_id}
                  labels={ticket.labels}
                  canEdit={Boolean(canEdit)}
                />
              ) : null}
            </div>
          </div>

            {/* Subtareas y relaciones: autosuficientes (D5), mismo patron que TicketLabelsRow/TicketDiscussion. */}
            {ticket ? (
              <TicketSubtasksSection
                ticketId={ticket.id}
                projectId={ticket.project_id}
                canEdit={Boolean(canEdit)}
              />
            ) : null}
            {ticket ? (
              <TicketRelationsSection
                ticketId={ticket.id}
                projectId={ticket.project_id}
                canEdit={Boolean(canEdit)}
              />
            ) : null}

            <div className="flex-1 space-y-5 border-t-2 border-border pt-6">
              <LazyRichEditor
                value={parseRichTextJson(description)}
                placeholder="Describe el contexto, avances y decisiones del ticket..."
                disabled={isLoading || !canEdit}
                isLocked={isUnifiedEditorLocked}
                lockHint={
                  unifiedEditorLockOwner
                    ? `${unifiedEditorLockOwner} está editando, por favor espera.`
                    : undefined
                }
                onUploadImage={onUploadImage}
                onUploadVideo={onUploadVideo}
                onUploadDocument={onUploadDocument}
                attachmentScope={attachmentScope}
                mentionItems={mentionItems}
                onChange={(next) => {
                  if (activeFieldRef.current !== "description") {
                    return;
                  }

                  const serialized = JSON.stringify(next);

                  if (serialized === description) {
                    return;
                  }

                  markLocalChange("description");
                  dispatch({ type: "SET_DESCRIPTION", value: serialized });
                  onTypingField?.("description", serialized);
                }}
                onFocus={descriptionField.onFocus}
                onBlur={() => {
                  descriptionField.onBlur();
                  scheduleImmediateSave();
                }}
              />
            </div>

            {ticket ? (
              <TicketDiscussion ticketId={ticket.id} projectId={ticket.project_id} canComment={Boolean(canEdit)} />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <TicketDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={closeDeleteDialog}
        deleteKeyword={deleteKeyword}
        deleteConfirmation={deleteConfirmation}
        onDeleteConfirmationChange={setDeleteConfirmation}
        isDeleting={isDeleting}
        canConfirmDelete={canConfirmDelete}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </>
  );
}
