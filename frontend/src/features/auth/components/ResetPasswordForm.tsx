import { useMemo, useState } from "react";
import { Button, Input } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/errors";

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { confirmPasswordResetMutation } = useAuth();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      toast.error("Enlace invalido. Solicita uno nuevo.");
      return;
    }

    if (!password || !confirmPassword) {
      toast.error("Completa y confirma la contraseña");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    try {
      const response = await confirmPasswordResetMutation.mutateAsync({
        token,
        new_password: password,
      });
      toast.success(response.detail);
      navigate("/login");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo restablecer la contraseña"));
    }
  };

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">El enlace no es valido o esta incompleto.</p>
        <Link to="/forgot-password" className="text-brand-600 text-sm">
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <Input
        label="Nueva contraseña"
        type="password"
        value={password}
        onValueChange={setPassword}
      />
      <Input
        label="Confirmar nueva contraseña"
        type="password"
        value={confirmPassword}
        onValueChange={setConfirmPassword}
      />
      <Button
        color="primary"
        type="submit"
        className="w-full"
        isLoading={confirmPasswordResetMutation.isPending}
      >
        Restablecer contraseña
      </Button>
      <p className="text-sm text-zinc-500">
        <Link to="/login" className="text-brand-600">Volver al login</Link>
      </p>
    </form>
  );
}
