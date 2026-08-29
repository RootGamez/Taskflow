import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("UI error boundary caught:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
          <div className="border-2 border-border bg-card p-6 text-card-foreground shadow-hard-lg dark:shadow-hard-float">
            <h1 className="font-display text-lg font-bold tracking-tight text-foreground">
              Algo salió mal
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Recargá la página para continuar.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
