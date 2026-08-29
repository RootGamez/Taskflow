import { useState } from "react";
import { Button } from "@heroui/react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/errors";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const { requestPasswordResetMutation } = useAuth();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      toast.error("Ingresa tu correo");
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      toast.error("Ingresa un correo valido.");
      return;
    }

    try {
      const response = await requestPasswordResetMutation.mutateAsync({
        email: normalizedEmail,
      });
      toast.success(response.detail);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo procesar la solicitud"));
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <Button
        color="primary"
        type="submit"
        className="w-full rounded-none"
        isLoading={requestPasswordResetMutation.isPending}
      >
        Enviar enlace de recuperacion
      </Button>
      <p className="text-sm text-muted-foreground">
        ¿Recordaste tu contraseña?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
