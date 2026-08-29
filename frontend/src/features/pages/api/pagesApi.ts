import type {
  CreatePagePayload,
  PageDetail,
  PageSummary,
  UpdatePagePayload,
} from "@/features/pages/types/page.types";
import { apiClient } from "@/lib/axios";

export interface ListPagesParams {
  q?: string;
  project?: string;
}

export async function getPages(workspaceSlug: string, params: ListPagesParams = {}): Promise<PageSummary[]> {
  const { data } = await apiClient.get<PageSummary[]>(`/workspaces/${workspaceSlug}/pages/`, { params });
  return data;
}

export async function getPage(workspaceSlug: string, pageId: string): Promise<PageDetail> {
  const { data } = await apiClient.get<PageDetail>(`/workspaces/${workspaceSlug}/pages/${pageId}/`);
  return data;
}

export async function createPage(workspaceSlug: string, payload: CreatePagePayload): Promise<PageDetail> {
  const { data } = await apiClient.post<PageDetail>(`/workspaces/${workspaceSlug}/pages/`, payload);
  return data;
}

export async function updatePage(
  workspaceSlug: string,
  pageId: string,
  payload: UpdatePagePayload,
): Promise<PageDetail> {
  const { data } = await apiClient.patch<PageDetail>(`/workspaces/${workspaceSlug}/pages/${pageId}/`, payload);
  return data;
}

export async function deletePage(workspaceSlug: string, pageId: string): Promise<void> {
  await apiClient.delete(`/workspaces/${workspaceSlug}/pages/${pageId}/`);
}
