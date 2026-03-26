import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  due_date: string | null;
  column_id: string;
  description: string;
  progress_notes: string;
}

type EditableField = keyof TicketDraft;
type FieldLockMap = Record<EditableField, { userId: string; userName: string } | null>;
type RemoteLiveMap = Partial<Pick<TicketDraft, "title" | "description" | "progress_notes">>;

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
  onPatch?: (payload: Partial<TicketDraft>) => Promise<void>;
  onLockField?: (field: EditableField) => void;
  onUnlockField?: (field: EditableField) => void;
  onTypingField?: (field: EditableField, value: string) => void;
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
  } catch {
    // Legacy plain text should not crash editor mounting.
  }

  return null;
}

function buildDraft(ticket: Ticket): TicketDraft {
  const rawDescription = normalizeRichTextField(ticket.description).trim();
  const progressNotes = normalizeRichTextField(ticket.progress_notes).trim();
  let mergedDescription = rawDescription;

  // Backward compatibility: old tickets may still store plain text in progress_notes.
  if (!rawDescription.startsWith("{")) {
    mergedDescription = [rawDescription, progressNotes]
      .filter((segment): segment is string => Boolean(segment))
      .join("\n\n");
  }

  return {
    title: ticket.title,
    priority: ticket.priority,
    due_date: ticket.due_date,
    column_id: ticket.column_id,
    description: mergedDescription,
    progress_notes: "",
  };
}

function getDiff(prev: TicketDraft, next: TicketDraft): Partial<TicketDraft> {
  const payload: Partial<TicketDraft> = {};

  if (prev.title !== next.title && next.title.trim().length > 0) payload.title = next.title.trim();
  if (prev.priority !== next.priority) payload.priority = next.priority;
  if (prev.due_date !== next.due_date) payload.due_date = next.due_date;
  if (prev.column_id !== next.column_id && next.column_id) payload.column_id = next.column_id;
  if (prev.description !== next.description) {
    payload.description = next.description;
    payload.progress_notes = "";
  }

  return payload;
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
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [dueDateInput, setDueDateInput] = useState("");
  const [columnId, setColumnId] = useState("");
  const [description, setDescription] = useState("");
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [immediateSaveNonce, setImmediateSaveNonce] = useState(0);

  const hydratedTicketIdRef = useRef<string | null>(null);
  const activeFieldRef = useRef<EditableField | null>(null);
  const skipNextAutosaveRef = useRef(false);
  const pendingFieldsRef = useRef<Set<EditableField>>(new Set());
  const lastSyncedRef = useRef<TicketDraft | null>(null);
  const flushInFlightRef = useRef(false);
  const queuedDraftRef = useRef<TicketDraft | null>(null);

  const markFieldPending = (field: EditableField) => {
    pendingFieldsRef.current.add(field);
  };

  const markLocalChange = (field: EditableField) => {
    markFieldPending(field);
    setHasLocalChanges(true);
  };

  const clearPendingIfSynced = (serverDraft: TicketDraft) => {
    const pending = pendingFieldsRef.current;

    if (pending.has("title") && serverDraft.title === title.trim()) {
      pending.delete("title");
    }

    if (pending.has("priority") && serverDraft.priority === priority) {
      pending.delete("priority");
    }

    if (pending.has("column_id") && serverDraft.column_id === columnId) {
      pending.delete("column_id");
    }

    if (pending.has("due_date") && toDateInput(serverDraft.due_date) === dueDateInput) {
      pending.delete("due_date");
    }

    if (pending.has("description") && serverDraft.description === description) {
      pending.delete("description");
    }

  };

  const handleFieldFocus = (field: EditableField) => {
    activeFieldRef.current = field;
    onLockField?.(field);
  };

  const handleFieldBlur = (field?: EditableField) => {
    activeFieldRef.current = null;

    if (field) {
      onUnlockField?.(field);
    }
  };

  const isLockedByOther = (field: EditableField) =>
    Boolean(fieldLocks[field] && fieldLocks[field]?.userId !== currentUserId);

  useEffect(() => {
    if (!remoteLiveValues || !isOpen) {
      return;
    }

    const remoteDescription = [
      normalizeRichTextField(remoteLiveValues.description),
      normalizeRichTextField(remoteLiveValues.progress_notes),
    ]
      .filter((segment): segment is string => segment.length > 0)
      .join("\n\n");

    if (
      typeof remoteLiveValues.title === "string" &&
      activeFieldRef.current !== "title" &&
      remoteLiveValues.title !== title
    ) {
      skipNextAutosaveRef.current = true;
      setTitle(remoteLiveValues.title);
    }

    if (activeFieldRef.current !== "description" && remoteDescription && remoteDescription !== description) {
      skipNextAutosaveRef.current = true;
      setDescription(remoteDescription);
    }
  }, [description, isOpen, remoteLiveValues, title]);

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
      return;
    }

    const draft = buildDraft(ticket);
    clearPendingIfSynced(draft);

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

    if (canSyncField("title")) {
      setTitle(draft.title);
    }
    if (canSyncField("priority")) {
      setPriority(draft.priority);
    }
    if (canSyncField("due_date")) {
      setDueDateInput(toDateInput(draft.due_date));
    }
    if (canSyncField("column_id")) {
      setColumnId(draft.column_id);
    }
    if (canSyncField("description")) {
      setDescription(draft.description);
    }

    lastSyncedRef.current = draft;

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

  const draft = useMemo<TicketDraft>(
    () => ({
      title: title.trim(),
      priority,
      due_date: toApiDate(dueDateInput),
      column_id: columnId,
      description,
      progress_notes: "",
    }),
    [title, priority, dueDateInput, columnId, description],
  );

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

    flushInFlightRef.current = false;
  }, [canEdit, isOpen, onPatch, ticket]);

  useEffect(() => {
    if (!ticket || !canEdit || !onPatch || !isOpen || !isHydrated || !hasLocalChanges) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    queuedDraftRef.current = debouncedDraft;
    void flushDraft();
  }, [canEdit, debouncedDraft, flushDraft, hasLocalChanges, isHydrated, isOpen, onPatch, ticket]);

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

  const progressNotesLock = fieldLocks.progress_notes;
  const isProgressNotesLockedByOther = Boolean(
    progressNotesLock && progressNotesLock.userId !== currentUserId,
  );
  const isUnifiedEditorLocked = isLockedByOther("description") || isProgressNotesLockedByOther;
  const unifiedEditorLockOwner = isLockedByOther("description")
    ? fieldLocks.description?.userName
    : progressNotesLock?.userName;

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
              {isLockedByOther("title") ? (
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
                  setTitle(next);
                  onTypingField?.("title", next);
                }}
                onFocus={() => handleFieldFocus("title")}
                onBlur={() => handleFieldBlur("title")}
                placeholder="Escribe un titulo claro"
                disabled={isLoading || !canEdit || isLockedByOther("title")}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ticket-priority">Prioridad</Label>
                {isLockedByOther("priority") ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fieldLocks.priority?.userName} esta editando, por favor espera.
                  </p>
                ) : null}
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(event) => {
                    markLocalChange("priority");
                    setPriority(event.target.value as Priority);
                    scheduleImmediateSave();
                  }}
                  onFocus={() => handleFieldFocus("priority")}
                  onBlur={() => handleFieldBlur("priority")}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  disabled={isLoading || !canEdit || isLockedByOther("priority")}
                >
                  {PRIORITY_OPTIONS.map((option) => {
                    return (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-column">Estado</Label>
                {isLockedByOther("column_id") ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fieldLocks.column_id?.userName} esta editando, por favor espera.
                  </p>
                ) : null}
                <select
                  id="ticket-column"
                  value={columnId}
                  onChange={(event) => {
                    markLocalChange("column_id");
                    setColumnId(event.target.value);
                    scheduleImmediateSave();
                  }}
                  onFocus={() => handleFieldFocus("column_id")}
                  onBlur={() => handleFieldBlur("column_id")}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  disabled={isLoading || !canEdit || isLockedByOther("column_id")}
                >
                  {columns.length === 0 ? <option value="">Sin columnas</option> : null}
                  {columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-due-date">Fecha limite</Label>
                {isLockedByOther("due_date") ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fieldLocks.due_date?.userName} esta editando, por favor espera.
                  </p>
                ) : null}
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <Input
                    id="ticket-due-date"
                    type="date"
                    value={dueDateInput}
                    onChange={(event) => {
                      markLocalChange("due_date");
                      setDueDateInput(event.target.value);
                      scheduleImmediateSave();
                    }}
                    onFocus={() => handleFieldFocus("due_date")}
                    onBlur={() => handleFieldBlur("due_date")}
                    className="pl-9"
                    disabled={isLoading || !canEdit || isLockedByOther("due_date")}
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
                  const serialized = JSON.stringify(next);
                  markLocalChange("description");
                  setDescription(serialized);
                  onTypingField?.("description", serialized);
                }}
                onFocus={() => {
                  handleFieldFocus("description");
                  onLockField?.("progress_notes");
                }}
                onBlur={() => {
                  handleFieldBlur("description");
                  onUnlockField?.("progress_notes");
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
