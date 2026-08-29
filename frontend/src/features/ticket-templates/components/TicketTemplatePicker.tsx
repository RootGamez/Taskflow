import { useState } from "react";
import { FileText, LayoutTemplate, Settings2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { TemplateManagerDialog } from "@/features/ticket-templates/components/TemplateManagerDialog";
import { useTicketTemplates } from "@/features/ticket-templates/hooks/useTicketTemplates";
import { BUILT_IN_TEMPLATE } from "@/features/ticket-templates/lib/builtInTemplate";
import type { Priority } from "@/features/tickets/types/ticket.types";

/**
 * Forma minima que `CreateTicketModal` necesita para prefijar titulo,
 * descripcion y prioridad al aplicar una plantilla (D20 de
 * docs/PHASE_4_PLAN.md: solo el checklist se aplica en el servidor, este
 * objeto cubre la mitad que se aplica en el cliente).
 */
export interface AppliedTicketTemplate {
  id: string;
  title_template: string;
  /** JSON de Tiptap serializado como string, igual que `Ticket.description`. */
  description: string;
  priority: Priority;
}

interface TicketTemplatePickerProps {
  projectId: string;
  onApply: (template: AppliedTicketTemplate) => void;
  disabled?: boolean;
  /**
   * Titulo actual del borrador del modal, usado UNICAMENTE para decidir si
   * hace falta confirmacion antes de sobreescribirlo (RT-3/D28). Opcional y
   * conservador -- por defecto (`""`) se asume un borrador pristino y la
   * plantilla se aplica directo. Wireada end-to-end por el orquestador en
   * `CreateTicketModal.tsx` (`currentTitle={title}`) al cerrar la Ola 1.
   */
  currentTitle?: string;
}

interface TemplateOption {
  id: string;
  name: string;
  title_template: string;
  description: string;
  priority: Priority;
}

function toApplied(template: TemplateOption): AppliedTicketTemplate {
  return {
    id: template.id,
    title_template: template.title_template,
    description: template.description,
    priority: template.priority,
  };
}

/**
 * D19/D24/D28 de docs/PHASE_4_PLAN.md: boton + `Popover` en el aside de
 * metadata del modal de creacion. La opcion built-in (basada en
 * `DEFAULT_TICKET_DESCRIPTION`, D24) SIEMPRE aparece primera y no se puede
 * borrar; despues, las plantillas del proyecto; al final, "Administrar
 * plantillas" abre `TemplateManagerDialog` (D19: un `Dialog`, nunca una
 * ruta nueva).
 */
export function TicketTemplatePicker({
  projectId,
  onApply,
  disabled = false,
  currentTitle = "",
}: TicketTemplatePickerProps) {
  const { data: projectTemplates = [] } = useTicketTemplates(projectId);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<AppliedTicketTemplate | null>(null);

  const closePopover = (open: boolean) => {
    setIsPopoverOpen(open);
    if (!open) setPendingTemplate(null);
  };

  const applyAndClose = (template: AppliedTicketTemplate) => {
    onApply(template);
    setPendingTemplate(null);
    setIsPopoverOpen(false);
  };

  const requestApply = (template: AppliedTicketTemplate) => {
    // RT-3: si el usuario ya escribio un titulo, se pide confirmacion antes
    // de sobreescribirlo. D28 tambien contempla el contenido del editor,
    // pero esta prop solo cubre el titulo -- ver el comentario de
    // `currentTitle` arriba.
    if (currentTitle.trim().length > 0) {
      setPendingTemplate(template);
      return;
    }
    applyAndClose(template);
  };

  const openManager = () => {
    setIsPopoverOpen(false);
    setIsManagerOpen(true);
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={closePopover}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1.5 rounded border-2 border-border px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Usar plantilla
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          {pendingTemplate ? (
            <div className="flex flex-col gap-2 p-2 text-xs">
              <p className="text-muted-foreground">
                Ya escribiste un titulo. ¿Reemplazar con esta plantilla?
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingTemplate(null)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => applyAndClose(pendingTemplate)}
                  className="font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Aplicar igual
                </button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-0.5">
              <li>
                <button
                  type="button"
                  data-testid="template-option"
                  onClick={() => requestApply(toApplied(BUILT_IN_TEMPLATE))}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {BUILT_IN_TEMPLATE.name}
                </button>
              </li>

              {projectTemplates.length > 0 ? (
                <li role="separator" className="my-1 border-t border-border" />
              ) : null}

              {projectTemplates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    data-testid="template-option"
                    onClick={() => requestApply(toApplied(template))}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                    {template.name}
                  </button>
                </li>
              ))}

              <li role="separator" className="my-1 border-t border-border" />
              <li>
                <button
                  type="button"
                  onClick={openManager}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Administrar plantillas
                </button>
              </li>
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <TemplateManagerDialog projectId={projectId} isOpen={isManagerOpen} onOpenChange={setIsManagerOpen} />
    </>
  );
}
