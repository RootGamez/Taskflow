import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Select, SelectItem } from "@heroui/react";
import { AlertTriangle, ArrowDown, ArrowUp, Calendar, Check, Minus, User2 } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import { TicketRichEditor } from "@/features/tickets/components/TicketRichEditor";
import { useCollaborativeField } from "../hooks/useCollaborativeField";
import { useDebounce } from "@/hooks/useDebounce";
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
  onOpenChange: (open: boolean) => void;
  onPatch?: (payload: Partial<TicketPatchPayload>) => Promise<void>;
  onLockField?: (field: CollaborativeField) => void;
  onUnlockField?: (field: CollaborativeField) => void;
  onTypingField?: (field: CollaborativeField, value: string) => void;
  onDelete?: () => Promise<void>;
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
  };
}

function toPatchPayload(draft: TicketDraft): TicketPatchPayload {
  return {
    title: draft.title.trim(),
    priority: draft.priority,
    due_date: toApiDate(draft.due_date),
    column_id: draft.column_id,
    description: draft.description,
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

  return payload;
}

type DraftAction =
  | { type: "HYDRATE"; ticket: Ticket }
  | { type: "MERGE"; value: Partial<TicketDraft> }
  | { type: "SET_TITLE"; value: string }
  | { type: "SET_PRIORITY"; value: Priority }
  | { type: "SET_COLUMN"; value: string }
  | { type: "SET_DUE_DATE"; value: string }
  | { type: "SET_DESCRIPTION"; value: string };

const initialDraft: TicketDraft = {
  title: "",
  priority: "none",
  due_date: "",
  column_id: "",
  description: "",
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
  },
  remoteLiveValues,
  onOpenChange,
  onPatch,
  onLockField,
  onUnlockField,
  onTypingField,
  onDelete,
}: TicketDetailProps) {
  const [draftState, dispatch] = useReducer(draftReducer, initialDraft);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [immediateSaveNonce, setImmediateSaveNonce] = useState(0);

  const { title, priority, due_date, column_id, description } = draftState;
  const hydratedTicketIdRef = useRef<string | null>(null);
  const activeFieldRef = useRef<CollaborativeField | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const pendingFieldsRef = useRef<Set<EditableField>>(new Set());
  const lastSyncedRef = useRef<TicketPatchPayload | null>(null);
  const flushInFlightRef = useRef(false);
  const queuedDraftRef = useRef<TicketPatchPayload | null>(null);

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
            pendingFieldsRef.current.delete(key as EditableField);
          }
          lastSyncedRef.current = {
            ...baseline,
            ...payload,
          };
        } catch {
        }
      }

      if (!queuedDraftRef.current) {
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

    return Boolean(target.closest("[data-ticket-editor-floating='true']"));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-auto right-0 top-0 h-dvh w-full max-w-3xl translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-none border-l border-zinc-200 p-0 data-[state=closed]:slide-out-to-right-full data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-right-full data-[state=open]:fade-in-0 dark:border-zinc-800"
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
        <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <DialogTitle className="text-base">Ticket</DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-zinc-100 px-2 py-1 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              #{ticket?.id?.slice(0, 8) ?? "---"}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[calc(100dvh-88px)] flex-col">
          <section className="space-y-4 border-b border-zinc-200 px-6 py-5 dark:border-zinc-800">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Nombre</Label>
              {titleField.isLockedByOther ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {fieldLocks.title?.userName} esta editando, por favor espera.
                </p>
              ) : null}
              <Input
                id="ticket-title"
                value={title}
                onChange={(event) => {
                  const next = event.target.value;
                  markLocalChange("title");
                  dispatch({ type: "SET_TITLE", value: next });
                  onTypingField?.("title", next);
                }}
                onFocus={titleField.onFocus}
                onBlur={titleField.onBlur}
                placeholder="Escribe un titulo claro"
                disabled={isLoading || !canEdit || titleField.isLockedByOther}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ticket-priority">Prioridad</Label>
                {priorityField.isLockedByOther ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fieldLocks.priority?.userName} esta editando, por favor espera.
                  </p>
                ) : null}
                <Select
                  aria-label="Prioridad"
                  selectedKeys={[priority]}
                  onSelectionChange={(keys) => {
                    if (keys === "all") return;
                    const selectedPriority = String(Array.from(keys)[0] ?? "none") as Priority;
                    markLocalChange("priority");
                    dispatch({ type: "SET_PRIORITY", value: selectedPriority });
                    scheduleImmediateSave();
                  }}
                  onFocus={priorityField.onFocus}
                  onBlur={priorityField.onBlur}
                  className="w-full"
                  isDisabled={isLoading || !canEdit || priorityField.isLockedByOther}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value}>{option.label}</SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-column">Estado</Label>
                {columnField.isLockedByOther ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fieldLocks.column_id?.userName} esta editando, por favor espera.
                  </p>
                ) : null}
                <Select
                  aria-label="Estado"
                  selectedKeys={column_id ? [column_id] : []}
                  placeholder={columns.length === 0 ? "Sin columnas" : "Selecciona estado"}
                  onSelectionChange={(keys) => {
                    if (keys === "all") return;
                    const selectedColumn = String(Array.from(keys)[0] ?? "");
                    markLocalChange("column_id");
                    dispatch({ type: "SET_COLUMN", value: selectedColumn });
                    scheduleImmediateSave();
                  }}
                  onFocus={columnField.onFocus}
                  onBlur={columnField.onBlur}
                  className="w-full"
                  isDisabled={isLoading || !canEdit || columnField.isLockedByOther || columns.length === 0}
                >
                  {columns.map((column) => (
                    <SelectItem key={column.id}>
                      {column.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-due-date">Fecha limite</Label>
                {dueDateField.isLockedByOther ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fieldLocks.due_date?.userName} esta editando, por favor espera.
                  </p>
                ) : null}
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="ticket-due-date"
                    type="date"
                    value={due_date}
                    onChange={(event) => {
                      markLocalChange("due_date");
                      dispatch({ type: "SET_DUE_DATE", value: event.target.value });
                      scheduleImmediateSave();
                    }}
                    onFocus={dueDateField.onFocus}
                    onBlur={dueDateField.onBlur}
                    className="pl-9"
                    disabled={isLoading || !canEdit || dueDateField.isLockedByOther}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <User2 className="h-4 w-4" />
                <span>
                  Responsable: {ticket?.assignees?.[0]?.full_name || ticket?.assignees?.[0]?.email || "Sin asignar"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>Actualizacion en tiempo real</span>
              </div>
            </div>
          </section>

          <section className="flex-1 space-y-5 px-6 py-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                Contenido
              </p>
              <TicketRichEditor
                value={parseRichTextJson(description)}
                placeholder="Describe el contexto, avances, decisiones y bloqueos del ticket"
                disabled={isLoading || !canEdit}
                isLocked={isUnifiedEditorLocked}
                lockHint={
                  unifiedEditorLockOwner
                    ? `${unifiedEditorLockOwner} esta editando este ticket, por favor espera.`
                    : undefined
                }
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

            {canEdit && onDelete ? (
              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (window.confirm("Estas seguro? Esta accion no se puede deshacer.")) {
                      await onDelete();
                    }
                  }}
                  disabled={isLoading}
                >
                  Eliminar ticket
                </Button>
              </div>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
