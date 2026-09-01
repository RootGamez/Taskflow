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
  const currentUserId = useAuthStore((state) => state.user?.id);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const { data: workspaces = [], refetch: refetchWorkspaces } = useWorkspaces();

  // Aviso a pantalla completa cuando el usuario pierde el acceso al espacio
  // que esta viendo: o lo eliminaron (`workspace.deleted`) o lo sacaron a el
  // (`member.removed`). Un solo modal para ambos casos, con su propio texto.
  const [lockoutNotice, setLockoutNotice] = useState<{ title: string; description: string } | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // En rutas sin `:workspaceSlug` (p. ej. /tickets/:id, /my-tasks) igual
    // necesitamos un workspace activo para saber permisos/rol: si no hay
    // ninguno, caemos al que el backend marca activo (o el primero).
    if (!workspaceSlug) {
      if (!activeWorkspace && workspaces.length > 0) {
        setActiveWorkspace(workspaces.find((workspace) => workspace.is_active) ?? workspaces[0]);
      }
      return;
    }

    const routeWorkspace = workspaces.find((workspace) => workspace.slug === workspaceSlug);
    if (routeWorkspace && activeWorkspace?.id !== routeWorkspace.id) {
      setActiveWorkspace(routeWorkspace);
    }
  }, [activeWorkspace, setActiveWorkspace, workspaceSlug, workspaces]);

  const closeModal = useCallback(() => {
    setLockoutNotice(null);
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
      setLockoutNotice(null);
      setIsRedirecting(false);
      return;
    }

    navigate("/");
    setLockoutNotice(null);
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
          member?: { user_id?: string };
        };
      };

      if (data.type !== "workspace.event") {
        return;
      }

      if (data.event === "workspace.deleted") {
        const deletedSlug = data.payload?.workspace_slug;
        if (!deletedSlug || deletedSlug !== workspaceSlug) {
          return;
        }

        setLockoutNotice({
          title: "Espacio eliminado",
          description: `${data.payload?.workspace_name ?? "Este espacio"} fue eliminado.`,
        });
        return;
      }

      // Solo al miembro eliminado: al resto le llega el mismo evento para
      // refrescar la lista (ver useWorkspaceMembersRealtime).
      if (data.event === "member.removed") {
        const removedUserId = data.payload?.member?.user_id;
        if (!removedUserId || !currentUserId || removedUserId !== currentUserId) {
          return;
        }

        setLockoutNotice({
          title: "Ya no eres miembro de este espacio",
          description: "Alguien con permisos de administracion te elimino del espacio.",
        });
      }
    } catch {
      return;
    }
  }, [currentUserId, workspaceSlug]);

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
      <div className="flex h-[100dvh] bg-background text-foreground">
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

        {lockoutNotice ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/60 p-4">
            <div className="w-full max-w-md rounded border-2 border-border bg-card p-5 text-card-foreground shadow-hard-lg dark:shadow-hard-float">
              <h3 className="font-display text-base font-bold tracking-tight text-foreground">
                {lockoutNotice.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {lockoutNotice.description}
              </p>
              <div className="mt-4 flex gap-3 justify-end">
                <Button color="default" variant="bordered" className="rounded-none" onPress={closeModal}>
                  Entendido
                </Button>
                <Button
                  color="primary"
                  className="rounded-none"
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
