import { useState } from "react";
import { Button, Chip, Input } from "@heroui/react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";

interface LoginFormState {
  email: string;
  password: string;
}

export function LoginForm() {
  const [state, setState] = useState<LoginFormState>({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const { loginMutation } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/workspaces/ws-demo";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!state.email || !state.password) {
      setError("Completa email y contraseña");
      return;
    }

    try {
      await loginMutation.mutateAsync(state);
      navigate(from);
    } catch {
      setError("No se pudo iniciar sesión");
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error ? <Chip color="danger" variant="flat">{error}</Chip> : null}
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
