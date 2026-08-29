import { type ReactNode, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { useCreateTicketInstant } from "@/features/tickets/hooks/useCreateTicketInstant";
import { getApiErrorMessage } from "@/lib/errors";

interface QuickCreatePopoverProps {
  /** Espacio del que se listan los proyectos. */
  workspaceSlug: string;
  /** Disparador del popover (un botón "+ Nuevo ticket", normalmente). */
  children: ReactNode;
  align?: "start" | "center" | "end";
}

const selectClass =
  "w-full border-2 border-border bg-card px-2 py-1.5 text-sm text-foreground rounded " +
  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:opacity-50";

/**
 * RD-7 de docs/BRUTALIST_REDESIGN_PLAN.md §9: cuando se crea un ticket sin
 * contexto de proyecto/columna (un "+ Nuevo ticket" global), no se puede
 * inferir dónde va. Este popover —NO un modal, NO un formulario de
 * contenido— resuelve los dos únicos datos que faltan (Proyecto y Columna)
 * y delega el resto en la creación instantánea: al pulsar "Crear" se navega
 * directo al detalle del ticket recién creado.
 */
export function QuickCreatePopover({ workspaceSlug, children, align = "end" }: QuickCreatePopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: projects = [], isLoading } = useProjects(workspaceSlug);
  const [projectId, setProjectId] = useState("");
  const [columnId, setColumnId] = useState("");

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const columns = useMemo(
    () => [...(selectedProject?.columns ?? [])].sort((a, b) => a.order - b.order),
    [selectedProject],
  );

  // Preselecciona el primer proyecto al abrir (una vez que hay datos).
  useEffect(() => {
    if (!open || projectId || projects.length === 0) return;
    setProjectId(projects[0].id);
  }, [open, projectId, projects]);

  // Mantiene la columna válida para el proyecto elegido.
  useEffect(() => {
    setColumnId((current) =>
      columns.some((column) => column.id === current) ? current : columns[0]?.id ?? "",
    );
  }, [columns]);

  const { createTicketInstant, isCreating } = useCreateTicketInstant(projectId);

  const canCreate = Boolean(projectId && columnId) && !isCreating;

  const handleCreate = async () => {
    if (!canCreate) return;
    try {
      await createTicketInstant({ columnId });
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el ticket"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-80 space-y-3">
        <p className="eyebrow">Nuevo ticket</p>

        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando proyectos…" : "No hay proyectos en este espacio."}
          </p>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="eyebrow">Proyecto</span>
              <select
                aria-label="Proyecto"
                className={selectClass}
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={isCreating}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="eyebrow">Columna</span>
              <select
                aria-label="Columna"
                className={selectClass}
                value={columnId}
                onChange={(event) => setColumnId(event.target.value)}
                disabled={isCreating || columns.length === 0}
              >
                {columns.length === 0 ? (
                  <option value="">Sin columnas</option>
                ) : (
                  columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <Button type="button" className="w-full" onClick={handleCreate} disabled={!canCreate}>
              {isCreating ? "Creando…" : "Crear"}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
