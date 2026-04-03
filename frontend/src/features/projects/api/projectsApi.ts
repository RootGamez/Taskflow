import type { Project } from "@/features/projects/types/project.types";
import { apiClient } from "@/lib/axios";

interface CreateProjectPayload {
  name: string;
  description?: string;
  color?: string;
}

interface UpdateProjectPayload {
  name?: string;
  description?: string;
  color?: string;
  is_archived?: boolean;
}

class ProjectsApi {
  async getProjectsByWorkspace(workspaceSlug: string): Promise<Project[]> {
    const { data } = await apiClient.get<Project[]>(`/workspaces/${workspaceSlug}/projects/`);
    return data;
  }

  async createProject(
    workspaceSlug: string,
    payload: CreateProjectPayload,
  ): Promise<Project> {
    const { data } = await apiClient.post<Project>(`/workspaces/${workspaceSlug}/projects/`, payload);
    return data;
  }

  async getProjectById(
    workspaceSlug: string,
    projectId: string,
  ): Promise<Project> {
    const { data } = await apiClient.get<Project>(
      `/workspaces/${workspaceSlug}/projects/${projectId}/`,
    );
    return data;
  }

  async updateProject(
    workspaceSlug: string,
    projectId: string,
    payload: UpdateProjectPayload,
  ): Promise<Project> {
    const { data } = await apiClient.patch<Project>(
      `/workspaces/${workspaceSlug}/projects/${projectId}/`,
      payload,
    );
    return data;
  }

  async deleteProject(workspaceSlug: string, projectId: string): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceSlug}/projects/${projectId}/`);
  }
}

export const projectsApi = new ProjectsApi();

export const getProjectsByWorkspace = (workspaceSlug: string) =>
  projectsApi.getProjectsByWorkspace(workspaceSlug);

export const createProject = (workspaceSlug: string, payload: CreateProjectPayload) =>
  projectsApi.createProject(workspaceSlug, payload);

export const getProjectById = (workspaceSlug: string, projectId: string) =>
  projectsApi.getProjectById(workspaceSlug, projectId);

export const updateProject = (
  workspaceSlug: string,
  projectId: string,
  payload: UpdateProjectPayload,
) => projectsApi.updateProject(workspaceSlug, projectId, payload);

export const deleteProject = (workspaceSlug: string, projectId: string) =>
  projectsApi.deleteProject(workspaceSlug, projectId);
