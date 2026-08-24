import { Card, CardBody } from "@heroui/react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <Card className="w-full max-w-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardBody className="space-y-4 p-6">
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Crear cuenta</h1>
          <RegisterForm />
        </CardBody>
      </Card>
    </AuthLayout>
  );
}
