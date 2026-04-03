import { Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SettingsLayout } from "@/components/layout/SettingsLayout";
import { useAuthStore } from "@/store/authStore";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import DashboardPage from "@/pages/DashboardPage";
import WorkspaceDashboardPage from "@/pages/workspace/WorkspaceDashboardPage";
import WorkspaceMembersPage from "@/pages/workspace/WorkspaceMembersPage";
import WorkspaceSettingsPage from "@/pages/workspace/WorkspaceSettingsPage";
import KanbanPage from "@/pages/project/KanbanPage";
import ListPage from "@/pages/project/ListPage";
import TicketDetailPage from "@/pages/ticket/TicketDetailPage";
import { UserProfilePage } from "@/pages/user/UserProfilePage";
import { UserSecurityPage } from "@/pages/user/UserSecurityPage";
import { UserAccountPage } from "@/pages/user/UserAccountPage";
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
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/",
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: "/dashboard",
        element: <DashboardPage />,
      },
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
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <KanbanPage />
          </Suspense>
        ),
      },
      {
        path: "/workspaces/:workspaceSlug/projects/:projectId/list",
        element: (
          <Suspense fallback={<LoadingSpinner />}>
            <ListPage />
          </Suspense>
        ),
      },
      {
        path: "/tickets/:ticketId",
        element: <TicketDetailPage />,
      },
      {
        path: "/settings",
        element: <SettingsLayout />,
        children: [
          {
            path: "profile",
            element: <UserProfilePage />,
          },
          {
            path: "security",
            element: <UserSecurityPage />,
          },
          {
            path: "account",
            element: <UserAccountPage />,
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
], {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  }
});
