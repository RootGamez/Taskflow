import { useState } from "react";
import { isAxiosError } from "axios";
import { Plus, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/shadcn/dialog";
import { TemplateEditorForm } from "@/features/ticket-templates/components/TemplateEditorForm";
import {
  useCreateTicketTemplate,
  useDeleteTicketTemplate,
  useTicketTemplates,
  useUpdateTicketTemplate,
} from "@/features/ticket-templates/hooks/useTicketTemplates";
import type {
  TicketTemplate,
  TicketTemplateWritePayload,
} from "@/features/ticket-templates/types/ticketTemplate.types";

interface TemplateManagerDialogProps {
  projectId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function getTemplateErrorMessage(error: unknown): string {
  if (isAxiosError<{ detail?: string }>(error) && typeof error.response?.data?.detail === "string") {
    return error.response.data.detail;
  }
  return "No se pudo guardar la plantilla.";
}

/**
 * D19 de docs/PHASE_4_PLAN.md: la administracion de plantillas es este
 * `Dialog`, NO una ruta -- se abre desde "Administrar plantillas" en
 * `TicketTemplatePicker`. Dos paneles (D28): lista a la izquierda,
 * formulario (`TemplateEditorForm`) a la derecha. D27: sin WebSocket ni
 * `Activity` -- las mutaciones invalidan `templateQueryKeys.list(projectId)`
 * (dentro de `useTicketTemplates.ts`).
 */
export function TemplateManagerDialog({ projectId, isOpen, onOpenChange }: TemplateManagerDialogProps) {
  const { data: templates = [] } = useTicketTemplates(projectId);
  const createTemplate = useCreateTicketTemplate(projectId);
  const updateTemplate = useUpdateTicketTemplate(projectId);
  const deleteTemplate = useDeleteTicketTemplate(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? null;

  const handleSelect = (template: TicketTemplate) => {
    setSelectedId(template.id);
    setErrorMessage(null);
  };

  const handleCreateNew = () => {
    setSelectedId(null);
    setErrorMessage(null);
  };

  const handleSubmit = (payload: TicketTemplateWritePayload) => {
    setErrorMessage(null);
    const mutation = selectedTemplate
      ? updateTemplate.mutateAsync({ templateId: selectedTemplate.id, payload })
      : createTemplate.mutateAsync(payload);

    mutation
      .then((template) => setSelectedId(template.id))
      .catch((error: unknown) => setErrorMessage(getTemplateErrorMessage(error)));
  };

  const requestDelete = (templateId: string) => setPendingDeleteId(templateId);

  const confirmDelete = (templateId: string) => {
    deleteTemplate.mutate(templateId, {
      onSuccess: () => {
        if (selectedId === templateId) setSelectedId(null);
      },
    });
    setPendingDeleteId(null);
  };

  const isSubmitting = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b-2 border-border px-5 py-4">
          <DialogTitle>Administrar plantillas</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r-2 border-border p-3">
            {templates.length === 0 ? (
              <p className="px-1 py-2 text-center text-xs text-muted-foreground">
                Este proyecto no tiene plantillas todavia. Crea la primera para reusar checklists comunes.
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {templates.map((template) => (
                  <li key={template.id}>
                    {pendingDeleteId === template.id ? (
                      <div className="flex flex-col gap-1 rounded px-2 py-1.5 text-xs">
                        <span className="text-muted-foreground">¿Eliminar "{template.name}"?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => confirmDelete(template.id)}
                            className="font-medium text-destructive transition-colors hover:text-destructive/80"
                          >
                            Si, eliminar
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelect(template)}
                        aria-current={selectedId === template.id}
                        className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent ${
                          selectedId === template.id
                            ? "bg-secondary font-medium text-foreground"
                            : ""
                        }`}
                      >
                        <span className="truncate">{template.name}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Eliminar plantilla ${template.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDelete(template.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.stopPropagation();
                              requestDelete(template.id);
                            }
                          }}
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-1 flex items-center gap-1 rounded px-2 py-1.5 text-left text-xs font-medium text-primary transition-colors hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva plantilla
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <TemplateEditorForm
              key={selectedId ?? "new"}
              initialTemplate={selectedTemplate}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
