import { Button, Card, CardBody, Chip } from "@heroui/react";
import { ArrowRight, FolderOpen, Plus, Sparkles, Ticket as TicketIcon, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { PageHeader } from "@/components/ui/PageHeader";
import { CreateProjectModal } from "@/features/projects/components/CreateProjectModal";
import { ProjectDeleteDialog } from "@/features/projects/components/ProjectDeleteDialog";
import { ProjectList } from "@/features/projects/components/ProjectList";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useToggleProjectArchive,
  useUpdateProject,
} from "@/features/projects/hooks/useProjects";
import type { Project } from "@/features/projects/types/project.types";
import { getTicketsByProject } from "@/features/tickets/api/ticketsApi";
import type { Ticket } from "@/features/tickets/types/ticket.types";
import { CreateWorkspaceModal } from "@/features/workspaces/components/CreateWorkspaceModal";
import { canMutateWorkspace } from "@/features/workspaces/lib/permissions";
import { useCreateWorkspace, useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import type { Workspace } from "@/features/workspaces/types/workspace.types";
import { getApiErrorMessage } from "@/lib/errors";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface RecentTicketEntry {
  ticket: Ticket;
  projectName: string;
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Fecha desconocida";
  }

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

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
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const currentWorkspace = activeWorkspace ?? workspaces.find((workspace) => workspace.is_active) ?? workspaces[0] ?? null;
  const workspaceSlug = currentWorkspace?.slug ?? "";
  const canMutate = canMutateWorkspace(currentWorkspace?.role);

  useEffect(() => {
    if (currentWorkspace && activeWorkspace?.id !== currentWorkspace.id) {
      setActiveWorkspace(currentWorkspace);
    }
  }, [activeWorkspace?.id, currentWorkspace, setActiveWorkspace]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    console.info("[Dashboard] theme/workspace", {
      theme: isDark ? "dark" : "light",
      workspaceSlug,
      workspaces: workspaces.length,
      currentWorkspace: currentWorkspace?.name ?? null,
    });
  }, [workspaceSlug, workspaces.length, currentWorkspace?.name]);

  const projectsQuery = useProjects(workspaceSlug);
  const projects = (projectsQuery.data ?? []) as Project[];
  const createProjectMutation = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();
  const toggleProjectArchiveMutation = useToggleProjectArchive();

  const ticketQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: ["dashboard", "tickets", workspaceSlug, project.id],
      queryFn: () => getTicketsByProject(project.id),
      enabled: Boolean(workspaceSlug),
      staleTime: 0,
    })),
  }) as Array<{ data?: Ticket[] }>;

  const recentWorkspaces = useMemo(() => {
    const prioritized = currentWorkspace
      ? [currentWorkspace, ...workspaces.filter((workspace) => workspace.id !== currentWorkspace.id)]
      : workspaces;
    return prioritized.slice(0, 4);
  }, [currentWorkspace, workspaces]);

  const recentTickets = useMemo<RecentTicketEntry[]>(() => {
    return ticketQueries
      .flatMap((query, index) => {
        const project = projects[index];
        if (!project || !query.data) {
          return [];
        }

        return query.data.map((ticket) => ({
          ticket,
          projectName: project.name,
        }));
      })
      .sort((left, right) => new Date(right.ticket.updated_at).getTime() - new Date(left.ticket.updated_at).getTime())
      .slice(0, 8);
  }, [projects, ticketQueries]);

  const workspaceStats = [
    {
      label: "Espacios",
      value: workspaces.length,
      icon: Users,
      helper: currentWorkspace ? `Activo: ${currentWorkspace.name}` : "Sin espacio activo",
    },
    {
      label: "Proyectos",
      value: projects.length,
      icon: FolderOpen,
      helper: workspaceSlug ? `En ${currentWorkspace?.name ?? "tu espacio"}` : "Crea o selecciona un espacio de trabajo",
    },
    {
      label: "Tickets recientes",
      value: recentTickets.length,
      icon: TicketIcon,
      helper: recentTickets.length > 0 ? "Actividad reciente" : "Todavía no hay actividad",
    },
  ];

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

  const handleUpdateProject = async (input: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    if (!workspaceSlug || !projectToEdit) {
      return;
    }

    try {
      await updateProjectMutation.mutateAsync({
        workspaceSlug,
        projectId: projectToEdit.id,
        ...input,
      });
      setProjectToEdit(null);
      toast.success("Proyecto actualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el proyecto"));
    }
  };

  const handleToggleArchiveProject = async (project: Project) => {
    if (!workspaceSlug) {
      return;
    }

    try {
      await toggleProjectArchiveMutation.mutateAsync({
        workspaceSlug,
        projectId: project.id,
        isArchived: !project.is_archived,
      });
      toast.success(project.is_archived ? "Proyecto desarchivado" : "Proyecto archivado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo actualizar el estado del proyecto"));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!workspaceSlug) {
      return;
    }

    try {
      await deleteProjectMutation.mutateAsync({ workspaceSlug, projectId });
      setProjectToDelete(null);
      toast.success("Proyecto eliminado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo eliminar el proyecto"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={currentWorkspace ? `Espacio actual: ${currentWorkspace.name}` : "Empieza creando tu primer espacio o acepta una invitación"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="light" onPress={() => setIsCreateWorkspaceOpen(true)}>
              Crear espacio
            </Button>
            <Button color="primary" onPress={() => setIsCreateProjectOpen(true)} isDisabled={!workspaceSlug || !canMutate}>
              Nuevo proyecto
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {workspaceStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <CardBody className="space-y-2 p-4">
                <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                  <span className="text-sm font-medium">{stat.label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{stat.value}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{stat.helper}</p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Proyectos recientes</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Tus tableros del workspace actual.</p>
              </div>
              {currentWorkspace ? (
                <Chip color={canMutate ? "primary" : "default"} variant="flat" className="capitalize">
                  {currentWorkspace.role}
                </Chip>
              ) : null}
            </div>

            {workspaceSlug && projects.length > 0 ? (
              <ProjectList
                projects={projects}
                workspaceSlug={workspaceSlug}
                onEdit={setProjectToEdit}
                onToggleArchive={handleToggleArchiveProject}
                onDelete={setProjectToDelete}
                isActionLoading={updateProjectMutation.isPending || deleteProjectMutation.isPending || toggleProjectArchiveMutation.isPending}
              />
            ) : isLoadingWorkspaces ? (
              <p className="text-sm text-zinc-500">Cargando workspaces...</p>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {currentWorkspace
                  ? "No hay proyectos todavía. Crea el primero para empezar a organizar tickets."
                  : "No tienes espacios todavía. Crea uno para empezar o acepta una invitación pendiente."}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Espacios recientes</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Acceso rápido y vista completa en una página dedicada.</p>
              </div>
              <Button size="sm" variant="light" onPress={() => navigate("/workspaces")}>Ver todos</Button>
            </div>

            {recentWorkspaces.length > 0 ? (
              <div className="space-y-2">
                {recentWorkspaces.map((workspace) => (
                  <Link
                    key={workspace.id}
                    to={`/workspaces/${workspace.slug}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{workspace.name}</p>
                      <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{workspace.role}</p>
                    </div>
                    {workspaceSlug === workspace.slug ? (
                      <span className="text-xs font-medium text-brand-600">Actual</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                No tienes espacios de trabajo aún.
              </div>
            )}
          </CardBody>
        </Card>

      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Últimos tickets vistos</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Actividad reciente en tus proyectos.</p>
              </div>
              <Sparkles className="h-4 w-4 text-zinc-400" />
            </div>

            {recentTickets.length > 0 ? (
              <div className="space-y-2">
                {recentTickets.map(({ ticket, projectName }) => (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className="flex items-center justify-between rounded-2xl border border-zinc-200 px-4 py-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">{ticket.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{projectName}</p>
                    </div>
                    <div className="flex items-center gap-3 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="uppercase tracking-wider">{ticket.priority}</span>
                      <span>{formatRelativeDate(ticket.updated_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Aún no hay tickets recientes. Cuando abras o edites uno aparecerá aquí.
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardBody className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Guía para nuevos usuarios</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Si todavía no tienes nada cargado, sigue este flujo.</p>
            </div>

            <div className="space-y-3">
              {[
                {
                  title: "1. Crea tu primer espacio",
                  description: "Usa el botón de crear espacio para abrir un entorno propio del equipo.",
                },
                {
                  title: "2. Crea un proyecto",
                  description: "Dentro del espacio agrega un proyecto para empezar a organizar tickets y columnas.",
                },
                {
                  title: "3. Invita o acepta invitaciones",
                  description: "Si ya te invitaron, abre la campana de notificaciones y acepta la invitación. Si no, invita a tu equipo desde Miembros.",
                },
              ].map((step) => (
                <div key={step.title} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{step.title}</p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button color="primary" startContent={<Plus className="h-4 w-4" />} onPress={() => setIsCreateWorkspaceOpen(true)}>
                Crear espacio
              </Button>
              <Button
                variant="light"
                startContent={<ArrowRight className="h-4 w-4" />}
                onPress={() => workspaceSlug ? navigate(`/workspaces/${workspaceSlug}`) : undefined}
                isDisabled={!workspaceSlug}
              >
                Ir al espacio actual
              </Button>
            </div>
          </CardBody>
        </Card>
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

      <CreateProjectModal
        isOpen={Boolean(projectToEdit) && canMutate && Boolean(workspaceSlug)}
        onClose={() => setProjectToEdit(null)}
        onSubmit={handleUpdateProject}
        isLoading={updateProjectMutation.isPending}
        title="Editar proyecto"
        description="Actualiza el nombre, la descripcion y el color del proyecto."
        submitLabel="Guardar cambios"
        initialValues={projectToEdit ? {
          name: projectToEdit.name,
          description: projectToEdit.description ?? "",
          color: projectToEdit.color,
        } : undefined}
      />

      <ProjectDeleteDialog
        project={projectToDelete}
        isOpen={Boolean(projectToDelete) && canMutate && Boolean(workspaceSlug)}
        onClose={() => setProjectToDelete(null)}
        onDelete={handleDeleteProject}
        isLoading={deleteProjectMutation.isPending}
      />
    </div>
  );
}
