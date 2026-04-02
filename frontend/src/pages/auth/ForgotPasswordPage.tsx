import { Card, CardBody } from "@heroui/react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Recuperar contraseña</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Te enviaremos un enlace temporal para restablecer tu contraseña.
          </p>
          <ForgotPasswordForm />
        </CardBody>
      </Card>
    </AuthLayout>
  );
}
