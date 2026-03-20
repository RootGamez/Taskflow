import { useState } from "react";
import { Button, Input } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
  const from = (location.state as { from?: string } | null)?.from ?? "/workspaces/ws-demo";

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
      <Input
        label="Email"
        type="email"
        value={state.email}
        onValueChange={(email) => setState((prev) => ({ ...prev, email }))}
      />
      <Input
        label="Contraseña"
        type="password"
        value={state.password}
        onValueChange={(password) => setState((prev) => ({ ...prev, password }))}
      />
      <Button color="primary" type="submit" className="w-full" isLoading={loginMutation.isPending}>
        Iniciar sesión
      </Button>
      <p className="text-sm text-zinc-500">
        ¿No tienes cuenta? <Link to="/register" className="text-brand-600">Regístrate</Link>
      </p>
    </form>
  );
}
