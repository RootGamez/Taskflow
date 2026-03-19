import type { Ticket } from "@/features/tickets/types/ticket.types";

const now = new Date();

const MOCK_TICKETS: Ticket[] = [
  {
    id: "t-1",
    project_id: "p-1",
    column_id: "c-backlog",
    created_by: "u-1",
    title: "Definir arquitectura de notificaciones",
    description: null,
    priority: "high",
    order: 1,
    due_date: new Date(now.getTime() + 86400000).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    assignees: [],
    labels: [{ id: "l-1", project_id: "p-1", name: "Backend", color: "#9333EA" }],
  },
  {
    id: "t-2",
    project_id: "p-1",
    column_id: "c-progress",
    created_by: "u-1",
    title: "Diseñar estado del sidebar colapsable",
    description: null,
    priority: "medium",
    order: 2,
    due_date: new Date(now.getTime() - 86400000).toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    assignees: [],
    labels: [{ id: "l-2", project_id: "p-1", name: "Frontend", color: "#2563EB" }],
  },
];

export async function getTicketsByProject(_projectId: string): Promise<Ticket[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return MOCK_TICKETS;
}

export async function getTicketById(ticketId: string): Promise<Ticket | null> {
  await new Promise((resolve) => setTimeout(resolve, 180));
  return MOCK_TICKETS.find((ticket) => ticket.id === ticketId) ?? null;
}
