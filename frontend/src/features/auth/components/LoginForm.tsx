import { useState } from "react";
import { Button } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/errors";

interface LoginFormState {
  email: string;
  password: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function LoginForm() {
  const [state, setState] = useState<LoginFormState>({ email: "", password: "" });
  const { loginMutation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = state.email.trim();

    if (!email || !state.password) {
      toast.error("Completa email y contraseña");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Ingresa un correo valido.");
      return;
    }

    try {
      await loginMutation.mutateAsync({ ...state, email });
      toast.success("Sesión iniciada");
      navigate(from);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo iniciar sesión"));
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          value={state.email}
          onChange={(event) => setState((prev) => ({ ...prev, email: event.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">Contraseña</Label>
        <Input
          id="login-password"
          type="password"
          value={state.password}
          onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
        />
      </div>
      <Button
        color="primary"
        type="submit"
        className="w-full rounded-none"
        isLoading={loginMutation.isPending}
      >
        Iniciar sesión
      </Button>
      <p className="text-sm text-muted-foreground">
        <Link to="/forgot-password" className="font-medium text-primary hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}
