import { useState } from "react";
import { Button, Input } from "@heroui/react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";

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
      <Input
        label="Email"
        type="email"
        value={email}
        onValueChange={setEmail}
      />
      <Button
        color="primary"
        type="submit"
        className="w-full"
        isLoading={requestPasswordResetMutation.isPending}
      >
        Enviar enlace de recuperacion
      </Button>
      <p className="text-sm text-zinc-500">
        ¿Recordaste tu contraseña? <Link to="/login" className="text-brand-600">Inicia sesión</Link>
      </p>
    </form>
  );
}
