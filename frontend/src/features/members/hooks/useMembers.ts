import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getWorkspaceMembers,
  inviteWorkspaceMember,
  updateWorkspaceMemberRole,
} from "@/features/members/api/membersApi";
import type {
  InviteWorkspaceMemberPayload,
  UpdateWorkspaceMemberRolePayload,
} from "@/features/members/types/member.types";

export function useMembers(workspaceSlug: string) {
  return useQuery({
    queryKey: ["workspace-members", workspaceSlug],
    queryFn: () => getWorkspaceMembers(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useInviteWorkspaceMember(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InviteWorkspaceMemberPayload) => inviteWorkspaceMember(workspaceSlug, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceSlug] });
    },
  });
}

export function useUpdateWorkspaceMemberRole(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      memberId,
      payload,
    }: {
      memberId: string;
      payload: UpdateWorkspaceMemberRolePayload;
    }) => updateWorkspaceMemberRole(workspaceSlug, memberId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceSlug] });
    },
  });
}
