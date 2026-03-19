import { Tab, Tabs } from "@heroui/react";
import { useNavigate, useParams } from "react-router-dom";

import { ListView } from "@/features/tickets/components/ListView";
import { useTickets } from "@/features/tickets/hooks/useTickets";

export default function ListPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "ws-demo", projectId = "p-1" } = useParams();
  const { data: tickets = [] } = useTickets(projectId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Lista de tickets</h1>
        <Tabs selectedKey="list" onSelectionChange={(key) => {
          if (key === "board") navigate(`/workspaces/${workspaceSlug}/projects/${projectId}/board`);
        }}>
          <Tab key="board" title="Tablero" />
          <Tab key="list" title="Lista" />
        </Tabs>
      </div>
      <ListView tickets={tickets} />
    </div>
  );
}
