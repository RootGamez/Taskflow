import { useState } from "react";
import { Button, Input } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/errors";

interface RegisterFormState {
  full_name: string;
  email: string;
  password: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RegisterForm() {
  const [state, setState] = useState<RegisterFormState>({ full_name: "", email: "", password: "" });
  const { registerMutation } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = state.email.trim();

    if (!state.full_name || !email || !state.password) {
      toast.error("Completa todos los campos");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Ingresa un correo valido.");
      return;
    }

    try {
      await registerMutation.mutateAsync({ ...state, email });
      toast.success("Cuenta creada correctamente");
      navigate("/workspaces/ws-demo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo crear la cuenta"));
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
