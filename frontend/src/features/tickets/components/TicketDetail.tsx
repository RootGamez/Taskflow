import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Minus,
  MessageSquare,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/shadcn/textarea";
import type { Priority, Ticket } from "@/features/tickets/types/ticket.types";

const PRIORITY_OPTIONS: Array<{
  value: Priority;
  label: string;
  icon: any;
  style: string;
  badgeStyle: string;
}> = [
  {
    value: "urgent",
    label: "Urgente",
    icon: AlertTriangle,
    style: "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900",
    badgeStyle: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  },
  {
    value: "high",
    label: "Alta",
    icon: ArrowUp,
    style: "text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900",
    badgeStyle: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  },
  {
    value: "medium",
    label: "Media",
    icon: Minus,
    style: "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900",
    badgeStyle: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  },
  {
    value: "low",
    label: "Baja",
    icon: ArrowDown,
    style: "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900",
    badgeStyle: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  },
  {
    value: "none",
    label: "Sin prioridad",
    icon: Minus,
    style: "text-zinc-600 border-zinc-200 bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-700",
    badgeStyle: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300",
  },
];

const DEMO_COLUMNS = [
  { id: "1", name: "Backlog" },
  { id: "2", name: "En progreso" },
  { id: "3", name: "Hecho" },
];

const DEMO_LABELS = [
  { id: "1", name: "Bug", color: "#dc2626" },
  { id: "2", name: "Feature", color: "#2563eb" },
  { id: "3", name: "Enhancement", color: "#7c3aed" },
  { id: "4", name: "Documentation", color: "#059669" },
  { id: "5", name: "Performance", color: "#f59e0b" },
];

const DEMO_ASSIGNEES = [
  { id: "1", name: "Tu", initials: "TU" },
  { id: "2", name: "Juan", initials: "JD" },
  { id: "3", name: "María", initials: "MS" },
  { id: "4", name: "Carlos", initials: "CP" },
];

const DEMO_ACTIVITY = [
  {
    id: "1",
    user: "Demo User",
    action: "movió el ticket a",
    target: "En progreso",
    time: "hace 2 horas",
  },
  {
    id: "2",
    user: "Demo User",
    action: "cambió la prioridad a",
    target: "Alta",
    time: "hace 5 horas",
  },
  {
    id: "3",
    user: "Demo User",
    action: "creó el ticket",
    target: "",
    time: "hace 1 día",
  },
];

function formatDueDate(value: string | null): string {
  if (!value) return "Sin fecha límite";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin fecha límite";

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

interface TicketDetailProps {
  ticket: Ticket | null;
  isOpen: boolean;
  isLoading?: boolean;
  canEdit?: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (data: Partial<Ticket>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function TicketDetail({
  ticket,
  isOpen,
  isLoading = false,
  canEdit = true,
  onOpenChange,
  onUpdate,
  onDelete,
}: TicketDetailProps) {
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(
    typeof ticket?.description === "string" ? ticket.description : ""
  );
  const [priority, setPriority] = useState<Priority>(ticket?.priority ?? "none");
  const [dueDate, setDueDate] = useState(ticket?.due_date ?? "");
  const [selectedColumn, setSelectedColumn] = useState(ticket?.column_id ?? "");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (ticket && isOpen) {
      setTitle(ticket.title);
      setDescription(typeof ticket.description === "string" ? ticket.description : "");
      setPriority(ticket.priority);
      setDueDate(ticket.due_date ?? "");
      setSelectedColumn(ticket.column_id);
      setEditMode(false);
    }
  }, [ticket, isOpen]);

  const handleSave = async () => {
    if (!ticket || !onUpdate) return;
    await onUpdate({
      ...ticket,
      title,
      description: description ? { content: description } : null,
      priority,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
    setEditMode(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const toggleAssignee = (assigneeId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(assigneeId) ? prev.filter((id) => id !== assigneeId) : [...prev, assigneeId]
    );
  };

  const priorityOption = PRIORITY_OPTIONS.find((opt) => opt.value === priority);
  const selectedLabel = DEMO_LABELS.filter((l) => selectedLabels.includes(l.id));
  const selectedAssignee = DEMO_ASSIGNEES.filter((a) => selectedAssignees.includes(a.id));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        {/* Header */}
        <DialogHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-blue-100 text-cyan-700 dark:from-cyan-950/40 dark:to-blue-950/40 dark:text-cyan-300">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <span className="text-lg">
                  {editMode ? (
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Título del ticket"
                      className="border-cyan-200 bg-white/50"
                      disabled={isLoading}
                    />
                  ) : (
                    title
                  )}
                </span>
              </DialogTitle>
              <DialogDescription className="ml-11 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-mono text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                  #{ticket?.id?.slice(0, 8) || "---"}
                </span>
                <span>Creado {ticket?.created_at ? "hace un tiempo" : "recientemente"}</span>
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {editMode && canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(false)}
                  disabled={isLoading}
                >
                  Cancelar
                </Button>
              )}
              {canEdit ? (
                <Button
                  size="sm"
                  className={editMode ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" : ""}
                  onClick={editMode ? handleSave : () => setEditMode(true)}
                  disabled={isLoading || !title.trim()}
                >
                  {editMode ? "Guardar cambios" : "✏️ Editar"}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        {/* Main content */}
        <div className="grid gap-6 py-4 md:grid-cols-[1fr_320px]">
          {/* Form */}
          <div className="space-y-6">
            {/* Descripción */}
            <div className="space-y-2.5">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-zinc-500" />
                Descripción
              </Label>
              {editMode ? (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Agrega detalles y contexto..."
                  disabled={isLoading}
                  className="border-zinc-200 bg-white/50 dark:border-zinc-700 dark:bg-zinc-950/50"
                />
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-white/50 p-3 dark:border-zinc-700 dark:bg-zinc-950/50">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {description || (
                      <span className="text-zinc-400 dark:text-zinc-600">Sin descripción añadida</span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Configuración - 3 columnas */}
            <div className="grid gap-4 md:grid-cols-3">
              {/* Estado */}
              <div className="space-y-2.5">
                <Label htmlFor="ticket-column" className="flex items-center gap-2 text-sm font-semibold">
                  📍 Estado
                </Label>
                {editMode ? (
                  <select
                    id="ticket-column"
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Seleccionar columna</option>
                    {DEMO_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-white/50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950/50">
                    {DEMO_COLUMNS.find((c) => c.id === selectedColumn)?.name || "Sin estado"}
                  </div>
                )}
              </div>

              {/* Fecha límite */}
              <div className="space-y-2.5">
                <Label htmlFor="ticket-due-date" className="flex items-center gap-2 text-sm font-semibold">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  Fecha límite
                </Label>
                {editMode ? (
                  <Input
                    id="ticket-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isLoading}
                    className="border-zinc-200 bg-white/50 dark:border-zinc-700 dark:bg-zinc-950/50"
                  />
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-white/50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950/50">
                    {formatDueDate(dueDate)}
                  </div>
                )}
              </div>

              {/* Prioridad */}
              <div className="space-y-2.5">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-zinc-500" />
                  Prioridad
                </Label>
                {editMode ? (
                  <div className="flex gap-1.5">
                    {PRIORITY_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isActive = priority === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPriority(option.value)}
                          className={`group relative flex-1 rounded-lg border p-2 text-center text-xs font-medium transition ${
                            option.style
                          } ${
                            isActive
                              ? "ring-2 ring-offset-2 ring-zinc-300 dark:ring-offset-zinc-950 dark:ring-zinc-700"
                              : "hover:border-current"
                          }`}
                          disabled={isLoading}
                          title={option.label}
                        >
                          <Icon className="mx-auto h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`rounded-lg border p-3 text-center text-xs font-medium ${priorityOption?.style}`}>
                    {priorityOption?.label || "Sin prioridad"}
                  </div>
                )}
              </div>
            </div>

            {/* Asignados */}
            {editMode && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-zinc-500" />
                  Asignar a
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DEMO_ASSIGNEES.map((assignee) => {
                    const isSelected = selectedAssignees.includes(assignee.id);
                    return (
                      <button
                        key={assignee.id}
                        type="button"
                        onClick={() => toggleAssignee(assignee.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          isSelected
                            ? "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-300 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-700"
                            : "border border-zinc-200 text-zinc-600 hover:border-cyan-200 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-cyan-700"
                        }`}
                        disabled={isLoading}
                      >
                        {assignee.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Etiquetas */}
            {editMode && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Tag className="h-4 w-4 text-zinc-500" />
                  Etiquetas
                </Label>
                <div className="flex flex-wrap gap-2">
                  {DEMO_LABELS.map((label) => {
                    const isSelected = selectedLabels.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        type="button"
                        onClick={() => toggleLabel(label.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          isSelected ? "ring-2 ring-offset-1 dark:ring-offset-zinc-950" : "border hover:border-current"
                        }`}
                        style={{
                          borderColor: isSelected ? label.color : undefined,
                          backgroundColor: isSelected ? `${label.color}20` : undefined,
                          color: label.color,
                        }}
                        disabled={isLoading}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actividad y comentarios */}
            <div className="space-y-3 rounded-lg border border-zinc-200 bg-white/50 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-zinc-500" />
                Actividad
              </Label>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {DEMO_ACTIVITY.map((activity) => (
                  <div key={activity.id} className="flex gap-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                    <div className="h-8 w-8 rounded-full bg-zinc-200 flex-shrink-0 dark:bg-zinc-700" />
                    <div className="flex-1 text-xs">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {activity.user} <span className="text-zinc-600 dark:text-zinc-400">{activity.action}</span>
                      </p>
                      {activity.target && (
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">"{activity.target}"</p>
                      )}
                      <p className="mt-1 text-zinc-500 dark:text-zinc-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment input */}
              {canEdit ? (
                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Añade un comentario..."
                    disabled={isLoading}
                    className="border-zinc-200 bg-white/50 text-xs dark:border-zinc-700 dark:bg-zinc-900/50"
                  />
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => setComment("")}
                    disabled={!comment.trim() || isLoading}
                  >
                    Comentar
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Info Sidebar */}
          <aside className="space-y-3">
            <div className="rounded-xl border border-gradient-to-br from-cyan-200 to-blue-200 bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-4 dark:border-zinc-700 dark:from-cyan-950/20 dark:via-zinc-900/80 dark:to-blue-950/20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Resumen
                </p>
              </div>

              <div className="space-y-3 text-xs">
                {/* Estado */}
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">📍 Estado</p>
                  <p className="mt-1 rounded bg-white/50 px-2 py-1.5 text-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-400">
                    {DEMO_COLUMNS.find((c) => c.id === selectedColumn)?.name || "Sin estado"}
                  </p>
                </div>

                {/* Prioridad */}
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">🎯 Prioridad</p>
                  {priority !== "none" && (
                    <span className={`mt-1.5 inline-block rounded-full px-2.5 py-1 font-semibold ${priorityOption?.badgeStyle}`}>
                      {priorityOption?.label}
                    </span>
                  )}
                </div>

                {/* Fecha */}
                {dueDate && (
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">📅 Fecha</p>
                    <p className="mt-1 rounded bg-white/50 px-2 py-1.5 text-zinc-600 dark:bg-zinc-950/50 dark:text-zinc-400">
                      {formatDueDate(dueDate)}
                    </p>
                  </div>
                )}

                {/* Asignados */}
                {selectedAssignee.length > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">👥 Asignados</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedAssignee.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"
                        >
                          {a.initials}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Etiquetas */}
                {selectedLabel.length > 0 && (
                  <div>
                    <p className="font-semibold text-zinc-700 dark:text-zinc-300">🏷️ Etiquetas</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selectedLabel.map((l) => (
                        <span
                          key={l.id}
                          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${l.color}30`,
                            color: l.color,
                          }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creado */}
                <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <p className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                    <Clock className="h-3 w-3" />
                    Creado
                  </p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">hace 1 día</p>
                </div>
              </div>
            </div>

            {/* Peligro */}
            {canEdit && editMode && onDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={async () => {
                  if (window.confirm("¿Estás seguro? Esta acción no se puede deshacer.")) {
                    await onDelete();
                  }
                }}
                disabled={isLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar ticket
              </Button>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
