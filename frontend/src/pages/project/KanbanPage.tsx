import { Button, Select, SelectItem, Tab, Tabs } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { KanbanBoard } from "@/features/tickets/components/KanbanBoard";
import { TicketDetail } from "@/features/tickets/components/TicketDetail";
import { useTickets } from "@/features/tickets/hooks/useTickets";
import type { Ticket } from "@/features/tickets/types/ticket.types";

const COLUMNS = [
  { id: "c-backlog", project_id: "p-1", name: "Backlog", color: "#64748B", order: 1 },
  { id: "c-progress", project_id: "p-1", name: "En progreso", color: "#2563EB", order: 2 },
  { id: "c-done", project_id: "p-1", name: "Hecho", color: "#16A34A", order: 3 },
];

export default function KanbanPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo", projectId = "p-1" } = useParams();
  const { data: tickets = [] } = useTickets(projectId);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const projectColumns = useMemo(() => COLUMNS.filter((column) => column.project_id === projectId), [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Proyecto {projectId}</h1>
        <div className="flex items-center gap-2">
          <Tabs selectedKey="board" onSelectionChange={(key) => {
            if (key === "list") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/list`);
          }}>
            <Tab key="board" title="Tablero" />
            <Tab key="list" title="Lista" />
          </Tabs>
          <Button color="primary">Nuevo ticket</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select placeholder="Asignado" className="w-40"><SelectItem key="all">Todos</SelectItem></Select>
        <Select placeholder="Prioridad" className="w-40"><SelectItem key="all">Todas</SelectItem></Select>
        <Select placeholder="Etiqueta" className="w-40"><SelectItem key="all">Todas</SelectItem></Select>
      </div>

      <KanbanBoard columns={projectColumns} tickets={tickets} onOpenTicket={setSelectedTicket} />
      <TicketDetail ticket={selectedTicket} isOpen={Boolean(selectedTicket)} onOpenChange={(open) => (!open ? setSelectedTicket(null) : undefined)} />
    </div>
  );
}
