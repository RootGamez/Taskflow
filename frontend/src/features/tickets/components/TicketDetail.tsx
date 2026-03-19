import { Button, Drawer, DrawerBody, DrawerContent, DrawerHeader, Input, Select, SelectItem } from "@heroui/react";
import { MoreHorizontal } from "lucide-react";

import type { Ticket } from "@/features/tickets/types/ticket.types";

interface TicketDetailProps {
  ticket: Ticket | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TicketDetail({ ticket, isOpen, onOpenChange }: TicketDetailProps) {
  return (
    <Drawer isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
      <DrawerContent>
        {(onClose) => (
          <>
            <DrawerHeader className="flex items-center justify-between border-b border-zinc-200">
              <div className="text-sm text-zinc-600">Ticket #{ticket?.id ?? "-"}</div>
              <Button isIconOnly variant="light" onPress={onClose}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DrawerHeader>
            <DrawerBody className="space-y-4 p-6">
              <Input label="Titulo" value={ticket?.title ?? ""} readOnly />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="space-y-3 rounded-lg border border-zinc-200 p-4">
                  <h4 className="text-sm font-medium text-zinc-700">Propiedades</h4>
                  <Select label="Estado" selectedKeys={ticket ? [ticket.column_id] : []}>
                    <SelectItem key="c-backlog">Backlog</SelectItem>
                    <SelectItem key="c-progress">En progreso</SelectItem>
                    <SelectItem key="c-done">Hecho</SelectItem>
                  </Select>
                  <Select label="Prioridad" selectedKeys={ticket ? [ticket.priority] : []}>
                    <SelectItem key="urgent">Urgente</SelectItem>
                    <SelectItem key="high">Alta</SelectItem>
                    <SelectItem key="medium">Media</SelectItem>
                    <SelectItem key="low">Baja</SelectItem>
                    <SelectItem key="none">Sin prioridad</SelectItem>
                  </Select>
                </section>
                <section className="rounded-lg border border-zinc-200 p-4">
                  <h4 className="text-sm font-medium text-zinc-700">Descripcion</h4>
                  <div className="mt-3 rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
                    Placeholder de TipTap (se integra despues)
                  </div>
                </section>
              </div>
              <section className="rounded-lg border border-zinc-200 p-4">
                <h4 className="text-sm font-medium text-zinc-700">Actividad y comentarios</h4>
                <div className="mt-3 space-y-2 text-sm text-zinc-500">
                  <p>Demo User movio el ticket a En progreso.</p>
                  <Input placeholder="Escribe un comentario..." />
                </div>
              </section>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
