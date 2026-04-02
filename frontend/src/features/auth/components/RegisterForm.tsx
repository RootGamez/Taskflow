import { useState } from "react";
import { Button, Input } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/errors";

interface RegisterFormState {
  full_name: string;
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
}

type RegisterStep = "request-code" | "validate-code" | "set-password";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RegisterForm() {
  const [state, setState] = useState<RegisterFormState>({
    full_name: "",
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });
  const [step, setStep] = useState<RegisterStep>("request-code");
  const { registerRequestCodeMutation, registerValidateCodeMutation, registerVerifyCodeMutation } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = state.email.trim();

    if (!isValidEmail(email)) {
      toast.error("Ingresa un correo valido.");
      return;
    }

    if (step === "request-code") {
      if (!state.full_name || !email) {
        toast.error("Completa nombre y correo");
        return;
      }

      try {
        await registerRequestCodeMutation.mutateAsync({
          full_name: state.full_name,
          email,
        });
        setState((prev) => ({ ...prev, email }));
        setStep("validate-code");
        toast.success("Enviamos un codigo a tu correo");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo enviar el codigo"));
      }

      return;
    }

    if (step === "validate-code") {
      if (!state.code) {
        toast.error("Ingresa el codigo de verificacion");
        return;
      }

      try {
        await registerValidateCodeMutation.mutateAsync({
          email,
          code: state.code.trim(),
        });
        setStep("set-password");
        toast.success("Codigo verificado");
      } catch (error) {
        toast.error(getApiErrorMessage(error, "No se pudo validar el codigo"));
      }

      return;
    }

    if (!state.password || !state.confirmPassword) {
      toast.error("Completa y confirma la contraseña");
      return;
    }

    if (state.password !== state.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    try {
      await registerVerifyCodeMutation.mutateAsync({
        email,
        code: state.code.trim(),
        password: state.password,
      });
      toast.success("Cuenta creada correctamente");
      navigate("/workspaces/ws-demo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo verificar el codigo"));
    }
  };

  const onResendCode = async () => {
    const email = state.email.trim();

    if (!state.full_name || !email) {
      toast.error("Completa nombre y correo");
      return;
    }

    if (!isValidEmail(email)) {
      toast.error("Ingresa un correo valido.");
      return;
    }

    try {
      await registerRequestCodeMutation.mutateAsync({
        full_name: state.full_name,
        email,
      });
      toast.success("Codigo reenviado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo reenviar el codigo"));
    }
  };

  const isSubmitting =
    registerRequestCodeMutation.isPending ||
    registerValidateCodeMutation.isPending ||
    registerVerifyCodeMutation.isPending;

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      {step === "request-code" ? (
        <>
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
          <Button color="primary" type="submit" className="w-full" isLoading={isSubmitting}>
            Enviar codigo
          </Button>
        </>
      ) : step === "validate-code" ? (
        <>
          <Input
            label="Codigo de verificacion"
            value={state.code}
            onValueChange={(code) => setState((prev) => ({ ...prev, code }))}
            description={`Te enviamos un codigo a ${state.email}`}
          />
          <Button color="primary" type="submit" className="w-full" isLoading={isSubmitting}>
            Validar codigo
          </Button>
          <Button
            variant="light"
            type="button"
            className="w-full"
            onPress={onResendCode}
            isLoading={registerRequestCodeMutation.isPending}
          >
            Reenviar codigo
          </Button>
        </>
      ) : (
        <>
          <Input
            label="Crea tu contraseña"
            type="password"
            value={state.password}
            onValueChange={(password) => setState((prev) => ({ ...prev, password }))}
            description="Tu codigo ya fue validado correctamente"
          />
          <Input
            label="Confirma tu contraseña"
            type="password"
            value={state.confirmPassword}
            onValueChange={(confirmPassword) => setState((prev) => ({ ...prev, confirmPassword }))}
          />
          <Button color="primary" type="submit" className="w-full" isLoading={isSubmitting}>
            Crear cuenta
          </Button>
        </>
      )}

      <p className="text-sm text-zinc-500">
        ¿Ya tienes cuenta? <Link to="/login" className="text-brand-600">Inicia sesión</Link>
      </p>
    </form>
  );
}
