import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import WorkspaceDashboardPage from "@/pages/workspace/WorkspaceDashboardPage";
import WorkspaceMembersPage from "@/pages/workspace/WorkspaceMembersPage";
import WorkspaceSettingsPage from "@/pages/workspace/WorkspaceSettingsPage";
import KanbanPage from "@/pages/project/KanbanPage";
import ListPage from "@/pages/project/ListPage";
import TicketDetailPage from "@/pages/ticket/TicketDetailPage";
import NotFoundPage from "@/pages/NotFoundPage";

function ProtectedLayout() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/",
    element: <Navigate to="/workspaces/ws-demo" replace />,
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: "/workspaces/:workspaceSlug",
        element: <WorkspaceDashboardPage />,
      },
      {
        path: "/workspaces/:workspaceSlug/settings",
        element: <WorkspaceSettingsPage />,
      },
      {
        path: "/workspaces/:workspaceSlug/members",
        element: <WorkspaceMembersPage />,
      },
      {
        path: "/workspaces/:workspaceSlug/projects/:projectId/board",
        element: <KanbanPage />,
      },
      {
        path: "/workspaces/:workspaceSlug/projects/:projectId/list",
        element: <ListPage />,
      },
      {
        path: "/tickets/:ticketId",
        element: <TicketDetailPage />,
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
