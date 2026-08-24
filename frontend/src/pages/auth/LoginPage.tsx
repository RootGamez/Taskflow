import { Card, CardBody } from "@heroui/react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Iniciar sesion</h1>
          <LoginForm />
        </CardBody>
      </Card>
    </AuthLayout>
  );
}
