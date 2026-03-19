import { useState } from "react";
import { Button, Chip, Input } from "@heroui/react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";

interface RegisterFormState {
  full_name: string;
  email: string;
  password: string;
}

export function RegisterForm() {
  const [state, setState] = useState<RegisterFormState>({ full_name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const { registerMutation } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!state.full_name || !state.email || !state.password) {
      setError("Completa todos los campos");
      return;
    }

    try {
      await registerMutation.mutateAsync(state);
      navigate("/workspaces/ws-demo");
    } catch {
      setError("No se pudo crear la cuenta");
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error ? <Chip color="danger" variant="flat">{error}</Chip> : null}
      <Input
        label="Nombre completo"
        value={state.full_name}
        onValueChange={(full_name) => setState((prev) => ({ ...prev, full_name }))}
      />
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
      <Button color="primary" type="submit" className="w-full" isLoading={registerMutation.isPending}>
        Crear cuenta
      </Button>
      <p className="text-sm text-zinc-500">
        ¿Ya tienes cuenta? <Link to="/login" className="text-brand-600">Inicia sesión</Link>
      </p>
    </form>
  );
}
