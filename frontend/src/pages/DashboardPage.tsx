import { Button } from "@heroui/react";
import { AlertTriangle, FolderOpen, Ticket as TicketIcon, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { Card } from "@/components/ui/shadcn/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useWorkspaceStatuses } from "@/features/board/hooks/useWorkspaceStatuses";
import { DashboardProjectsPanel } from "@/features/dashboard/components/DashboardProjectsPanel";
import { DashboardStatBlock } from "@/features/dashboard/components/DashboardStatBlock";
import { QuickAccessPanel } from "@/features/dashboard/components/QuickAccessPanel";
import { UrgentTicketsPanel } from "@/features/dashboard/components/UrgentTicketsPanel";
import {
  countOpenTickets,
  countOverdueTickets,
  getDoneStatusIds,
} from "@/features/dashboard/lib/dashboardMetrics";
import { WeeklyBoardWidget } from "@/features/goals/components/WeeklyBoardWidget";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal";
import { useCreateProject, useProjects } from "@/features/projects/hooks/useProjects";
import type { Project } from "@/features/projects/types/project.types";
import { getTicketsByProject } from "@/features/tickets/api/ticketsApi";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { CreateWorkspaceModal } from "@/features/workspaces/components/CreateWorkspaceModal";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useCreateWorkspace, useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function DashboardPage() {
  const navigate = useNavigate();
  const workspacesQuery = useWorkspaces();
  const workspaces = (workspacesQuery.data ?? []) as Workspace[];
  const isLoadingWorkspaces = workspacesQuery.isLoading;
  const activeWorkspace = useWorkspaceStore(
    (state: { activeWorkspace: Workspace | null }) => state.activeWorkspace,
  );
  const setActiveWorkspace = useWorkspaceStore(
    (state: { setActiveWorkspace: (workspace: Workspace) => void }) => state.setActiveWorkspace,
  );
  const createWorkspaceMutation = useCreateWorkspace();
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);

  const currentWorkspace =
    activeWorkspace ?? workspaces.find((workspace) => workspace.is_active) ?? workspaces[0] ?? null;
  const workspaceSlug = currentWorkspace?.slug ?? "";
  const canMutate = canMutateWorkspace(currentWorkspace?.role);

  useEffect(() => {
    if (currentWorkspace && activeWorkspace?.id !== currentWorkspace.id) {
      setActiveWorkspace(currentWorkspace);
    }
  }, [activeWorkspace?.id, currentWorkspace, setActiveWorkspace]);

  const projectsQuery = useProjects(workspaceSlug);
  const projects = (projectsQuery.data ?? []) as Project[];
  const createProjectMutation = useCreateProject();

  const ticketQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ["dashboard", "tickets", workspaceSlug, project.id],
      queryFn: () => getTicketsByProject(project.id),
      enabled: Boolean(workspaceSlug),
      staleTime: 0,
    })),
  }) as Array<{ data?: Ticket[] }>;

  const statusesQuery = useWorkspaceStatuses(workspaceSlug);
  const doneStatusIds = useMemo(
    () => getDoneStatusIds(statusesQuery.data),
    [statusesQuery.data],
  );

  const ticketsByProjectId = useMemo<Record<string, Ticket[]>>(() => {
    const map: Record<string, Ticket[]> = {};
    ticketQueries.forEach((query, index) => {
      const project = projects[index];
      if (project && query.data) {
        map[project.id] = query.data;
      }
    });
    return map;
  }, [projects, ticketQueries]);

  const allTickets = useMemo(
    () => Object.values(ticketsByProjectId).flat(),
    [ticketsByProjectId],
  );

  const openTicketCount = useMemo(
    () => countOpenTickets(allTickets, doneStatusIds),
    [allTickets, doneStatusIds],
  );
  const overdueTicketCount = useMemo(
    () => countOverdueTickets(allTickets, doneStatusIds),
    [allTickets, doneStatusIds],
  );

  const recentWorkspaces = useMemo(() => {
    const prioritized = currentWorkspace
      ? [currentWorkspace, ...workspaces.filter((workspace) => workspace.id !== currentWorkspace.id)]
      : workspaces;
    return prioritized.slice(0, 4);
  }, [currentWorkspace, workspaces]);

  const handleCreateWorkspace = async (name: string) => {
    try {
      const workspace = await createWorkspaceMutation.mutateAsync(name);
      setActiveWorkspace(workspace);
      setIsCreateWorkspaceOpen(false);
      navigate(`/workspaces/${workspace.slug}`);
      toast.success("Espacio de trabajo creado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el espacio de trabajo"));
    }
  };

  const handleCreateProject = async (input: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    if (!workspaceSlug) {
      toast.error("Selecciona o crea un espacio de trabajo primero");
      return;
    }

    if (!canMutate) {
      toast.error("No tienes permisos para crear proyectos en este espacio");
      return;
    }

    try {
      const project = await createProjectMutation.mutateAsync({
        workspaceSlug,
        ...input,
      });
      setIsCreateProjectOpen(false);
      toast.success("Proyecto creado");
      navigate(`/workspaces/${workspaceSlug}/projects/${project.id}/board`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear el proyecto"));
    }
  };

  return (
    <div className="space-y-6">
      {workspaceSlug ? <WeeklyBoardWidget workspaceSlug={workspaceSlug} /> : null}

      <PageHeader
        eyebrow="Panel general"
        title="Dashboard"
        subtitle={
          currentWorkspace
            ? `Espacio actual: ${currentWorkspace.name}`
            : "Empieza creando tu primer espacio o acepta una invitación"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="light" className="rounded-none" onPress={() => setIsCreateWorkspaceOpen(true)}>
              Crear espacio
            </Button>
            <Button
              color="primary"
              className="rounded-none"
              onPress={() => setIsCreateProjectOpen(true)}
              isDisabled={!workspaceSlug || !canMutate}
            >
              Nuevo proyecto
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatBlock
          label="Espacios"
          value={workspaces.length}
          icon={Users}
          helper={currentWorkspace ? `Activo: ${currentWorkspace.name}` : "Sin espacio activo"}
        />
        <DashboardStatBlock
          label="Proyectos"
          value={projects.length}
          icon={FolderOpen}
          helper={
            workspaceSlug
              ? `En ${currentWorkspace?.name ?? "tu espacio"}`
              : "Crea o selecciona un espacio"
          }
        />
        <DashboardStatBlock
          label="Abiertos"
          value={openTicketCount}
          icon={TicketIcon}
          helper="Tickets sin completar"
        />
        <DashboardStatBlock
          label="Vencidos"
          value={overdueTicketCount}
          icon={AlertTriangle}
          helper="Tickets abiertos fuera de fecha"
          emphasis={overdueTicketCount > 0 ? "destructive" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <DashboardProjectsPanel
          workspaceSlug={workspaceSlug}
          projects={projects}
          ticketsByProjectId={ticketsByProjectId}
          doneStatusIds={doneStatusIds}
          isLoading={isLoadingWorkspaces || projectsQuery.isLoading}
          hasWorkspace={Boolean(currentWorkspace)}
        />

        {/* TODO(plan §10): panel de actividad del equipo requiere endpoint workspace-level.
            Hoy `features/activities` solo expone actividad por ticket
            (`GET /projects/<id>/tickets/<id>/activities/`), no un feed agregado
            a nivel espacio — se omite el panel hasta que exista ese endpoint. */}
        <Card className="flex flex-col">
          <header className="flex items-center justify-between gap-3 border-b-2 border-border px-4 py-3">
            <p className="eyebrow">Espacios recientes</p>
            <Button
              size="sm"
              variant="light"
              className="rounded-none"
              onPress={() => navigate("/workspaces")}
            >
              Ver todos
            </Button>
          </header>
          <div className="p-2">
            {recentWorkspaces.length > 0 ? (
              <ul className="divide-y divide-border">
                {recentWorkspaces.map((workspace) => (
                  <li key={workspace.id}>
                    <Link
                      to={`/workspaces/${workspace.slug}`}
                      className="flex items-center justify-between gap-3 rounded px-2 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {workspace.name}
                        </span>
                        <span className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                          {workspace.role}
                        </span>
                      </span>
                      {workspaceSlug === workspace.slug ? (
                        <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-primary">
                          Actual
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                No tienes espacios de trabajo aún.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <UrgentTicketsPanel />
        <QuickAccessPanel workspaceSlug={workspaceSlug || undefined} />
      </div>

      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onCreate={handleCreateWorkspace}
        isLoading={createWorkspaceMutation.isPending}
      />

      <CreateProjectModal
        isOpen={isCreateProjectOpen && canMutate && Boolean(workspaceSlug)}
        onClose={() => setIsCreateProjectOpen(false)}
        onSubmit={handleCreateProject}
        isLoading={createProjectMutation.isPending}
      />
    </div>
  );
}
