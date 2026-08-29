import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/Sheet";
import { useIsCompactNav } from "@/hooks/useBreakpoint";
import { useUIStore } from "@/store/uiStore";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { GlobalShortcutsProvider } from "@/features/shortcuts/components/GlobalShortcutsProvider";
import { KeyboardShortcutsDialog } from "@/features/shortcuts/components/KeyboardShortcutsDialog";
import { useWorkspaces } from "@/features/workspaces/hooks/useWorkspaces";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const isCompactNav = useIsCompactNav();
  const mobileNavOpen = useUIStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen);
  const { workspaceSlug = "" } = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const { data: workspaces = [], refetch: refetchWorkspaces } = useWorkspaces();

  const [deletedWorkspaceName, setDeletedWorkspaceName] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!workspaceSlug) {
      return;
    }

    const routeWorkspace = workspaces.find((workspace) => workspace.slug === workspaceSlug);
    if (routeWorkspace && activeWorkspace?.id !== routeWorkspace.id) {
      setActiveWorkspace(routeWorkspace);
    }
  }, [activeWorkspace?.id, setActiveWorkspace, workspaceSlug, workspaces]);

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

      setDeletedWorkspaceName(data.payload?.workspace_name ?? "este espacio");
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
    // GlobalShortcutsProvider envuelve TODO el shell (D52 de
    // docs/PHASE_3_PLAN.md, Wave 2/WP-D): monta el unico listener de
    // teclado `document`, una sola vez, para toda la app -- incluye
    // Sidebar/Topbar (y por lo tanto UserMenu, que abre el mismo dialogo
    // de ayuda via `shortcutsHelpDialogStore`).
    <GlobalShortcutsProvider>
      <div className="flex h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
        {/* Sidebar fijo solo en desktop (>= lg); en móvil/tablet va como drawer. */}
        {!isCompactNav ? <Sidebar /> : null}

        {isCompactNav ? (
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="p-0" showGrabber={false}>
              <SheetTitle className="sr-only">Navegación</SheetTitle>
              <Sidebar variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>

        {/* Overlay global, montado una sola vez (I6/D4 de
            docs/PHASE_3_PLAN.md). Stub de WP-0: devuelve null hasta que
            WP-A reemplace su cuerpo -- no requiere otra edicion aca. */}
        <CommandPalette />

        {/* Panel de ayuda (`?`) -- WP-D. Autosuficiente: lee/escribe su
            propio store (`shortcutsHelpDialogStore`), igual que
            `CommandPalette` arriba. */}
        <KeyboardShortcutsDialog />

        {deletedWorkspaceName ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Espacio eliminado</h3>
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
                  Ir a otro espacio
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </GlobalShortcutsProvider>
  );
}
