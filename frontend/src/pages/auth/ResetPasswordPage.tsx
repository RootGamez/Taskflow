import { Card, CardBody } from "@heroui/react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Crear nueva contraseña</h1>
          <ResetPasswordForm />
        </CardBody>
      </Card>
    </AuthLayout>
  );
}
