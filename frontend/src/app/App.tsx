import { RouterProvider } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <AppProviders router={router}>
        <Toaster
          position="top-left"
          containerClassName="taskflow-toast-container"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#111827",
              color: "#ffffff",
              border: "1px solid #374151",
            },
          }}
        />
        <RouterProvider router={router} />
      </AppProviders>
    </ErrorBoundary>
  );
}
