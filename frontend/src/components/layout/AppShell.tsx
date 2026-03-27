import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const { refetch: refetchWorkspaces } = useWorkspaces();

  const [deletedWorkspaceName, setDeletedWorkspaceName] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const closeModal = useCallback(() => {
    setDeletedWorkspaceName(null);
  }, []);

  const redirectToFallbackWorkspace = useCallback(async () => {
    if (isRedirecting) {
      return;
    }

    setIsRedirecting(true);

    const refreshed = await refetchWorkspaces();
    const workspaces = refreshed.data ?? [];
    const nextWorkspace = workspaces.find((workspace) => workspace.is_active) ?? workspaces[0] ?? null;

    if (nextWorkspace) {
      setActiveWorkspace(nextWorkspace);
      navigate(`/workspaces/${nextWorkspace.slug}`);
      setDeletedWorkspaceName(null);
      setIsRedirecting(false);
      return;
    }

    navigate("/");
    setDeletedWorkspaceName(null);
    setIsRedirecting(false);
  }, [isRedirecting, navigate, refetchWorkspaces, setActiveWorkspace]);

  const handleWorkspaceEvent = useCallback((event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as {
        type?: string;
        event?: string;
        payload?: {
          workspace_slug?: string;
          workspace_name?: string;
        };
      };

      if (data.type !== "workspace.event" || data.event !== "workspace.deleted") {
        return;
      }

      const deletedSlug = data.payload?.workspace_slug;
      if (!deletedSlug || deletedSlug !== workspaceSlug) {
        return;
      }

      setDeletedWorkspaceName(data.payload?.workspace_name ?? "este workspace");
    } catch {
      return;
    }
  }, [workspaceSlug]);

  useWebSocket(
    accessToken && workspaceSlug
      ? `/workspaces/${workspaceSlug}/events/?token=${encodeURIComponent(accessToken)}`
      : "",
    {
      enabled: Boolean(accessToken && workspaceSlug),
      onMessage: handleWorkspaceEvent,
    },
  );

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
      </div>

      {deletedWorkspaceName ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Workspace eliminado</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              {deletedWorkspaceName} fue eliminado.
            </p>
            <div className="mt-4 flex gap-3 justify-end">
              <Button
                color="default"
                variant="light"
                onPress={closeModal}
              >
                Entendido
              </Button>
              <Button
                color="primary"
                onPress={() => void redirectToFallbackWorkspace()}
                isLoading={isRedirecting}
              >
                Ir a otro workspace
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
