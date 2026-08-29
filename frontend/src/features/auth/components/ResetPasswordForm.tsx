import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
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
        <p className="text-sm text-muted-foreground">El enlace no es valido o esta incompleto.</p>
        <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Solicitar un nuevo enlace
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="reset-password">Nueva contraseña</Label>
        <Input
          id="reset-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="reset-confirm-password">Confirmar nueva contraseña</Label>
        <Input
          id="reset-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>
      <Button
        color="primary"
        type="submit"
        className="w-full rounded-none"
        isLoading={confirmPasswordResetMutation.isPending}
      >
        Restablecer contraseña
      </Button>
      <p className="text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          Volver al login
        </Link>
      </p>
    </form>
  );
}
