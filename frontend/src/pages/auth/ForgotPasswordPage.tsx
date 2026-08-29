import { KanbanSquare } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
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
            Recuperar contraseña
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Te enviaremos un enlace temporal para restablecer tu contraseña.
          </p>
        </div>
        <div className="p-6">
          <ForgotPasswordForm />
        </div>
      </div>
    </AuthLayout>
  );
}
