import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelWorkspaceInvitation,
  getWorkspaceInvitations,
  getWorkspaceMembers,
  inviteWorkspaceMember,
  updateWorkspaceMemberRole,
} from "@/features/members/api/membersApi";
import type {
  InviteWorkspaceMemberPayload,
  UpdateWorkspaceMemberRolePayload,
  WorkspaceInvitationSummary,
  WorkspaceMember,
} from "@/features/members/types/member.types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";

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

export function useWorkspaceInvitations(workspaceSlug: string) {
  return useQuery({
    queryKey: ["workspace-invitations", workspaceSlug],
    queryFn: () => getWorkspaceInvitations(workspaceSlug),
    enabled: Boolean(workspaceSlug),
  });
}

export function useCancelWorkspaceInvitation(workspaceSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => cancelWorkspaceInvitation(workspaceSlug, invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-invitations", workspaceSlug] });
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

export function useWorkspaceMembersRealtime(workspaceSlug: string) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);

  const upsertMember = useCallback((member: WorkspaceMember) => {
    queryClient.setQueryData<WorkspaceMember[]>(["workspace-members", workspaceSlug], (current) => {
      const previous = current ?? [];
      const exists = previous.some((item) => item.id === member.id);
      if (!exists) {
        return [...previous, member];
      }
      return previous.map((item) => (item.id === member.id ? member : item));
    });
  }, [queryClient, workspaceSlug]);

  const upsertInvitation = useCallback((invitation: WorkspaceInvitationSummary) => {
    queryClient.setQueryData<WorkspaceInvitationSummary[]>(["workspace-invitations", workspaceSlug], (current) => {
      const previous = current ?? [];
      const exists = previous.some((item) => item.id === invitation.id);
      if (!exists) {
        return [invitation, ...previous];
      }
      return previous.map((item) => (item.id === invitation.id ? invitation : item));
    });
  }, [queryClient, workspaceSlug]);

  const removeInvitation = useCallback((invitationId: string) => {
    queryClient.setQueryData<WorkspaceInvitationSummary[]>(["workspace-invitations", workspaceSlug], (current) => {
      const previous = current ?? [];
      return previous.filter((item) => item.id !== invitationId);
    });
  }, [queryClient, workspaceSlug]);

  const onMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as {
        type?: string;
        event?: string;
        payload?: {
          member?: WorkspaceMember;
          invitation?: WorkspaceInvitationSummary;
        };
      };

      if (data.type !== "workspace.event" || !data.event || !data.payload) {
        return;
      }

      if ((data.event === "member.joined" || data.event === "member.updated") && data.payload.member) {
        upsertMember(data.payload.member);
        return;
      }

      if ((data.event === "invitation.created" || data.event === "invitation.updated") && data.payload.invitation) {
        if (data.payload.invitation.status === "pending") {
          upsertInvitation(data.payload.invitation);
        } else {
          removeInvitation(data.payload.invitation.id);
        }
      }
    } catch {
      return;
    }
  }, [removeInvitation, upsertInvitation, upsertMember]);

  useWebSocket(
    accessToken ? `/workspaces/${workspaceSlug}/events/?token=${encodeURIComponent(accessToken)}` : "",
    {
      enabled: Boolean(workspaceSlug && accessToken),
      onMessage,
    },
  );
}
