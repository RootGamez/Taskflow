import { KanbanSquare } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout>
      <div className="w-full max-w-md border-2 border-border bg-card shadow-hard-lg dark:shadow-hard-float">
        <div className="border-b-2 border-border p-6">
          <div className="flex items-center gap-2.5">
            <span className="boxed-icon h-8 w-8 bg-primary text-primary-foreground">
              <KanbanSquare className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-[-0.02em] text-foreground">
              TASKFLOW
            </span>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
            Iniciar sesion
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accede con tu cuenta del equipo.
          </p>
        </div>
        <div className="p-6">
          <LoginForm />
        </div>
      </div>
    </AuthLayout>
  );
}
