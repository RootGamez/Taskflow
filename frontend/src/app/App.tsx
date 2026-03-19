import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders router={router}>
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  );
}
