import { useState } from "react";
import { Button } from "@heroui/react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
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
      navigate("/dashboard");
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
          <div className="space-y-1.5">
            <Label htmlFor="register-full-name">Nombre completo</Label>
            <Input
              id="register-full-name"
              value={state.full_name}
              onChange={(event) => setState((prev) => ({ ...prev, full_name: event.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="register-email">Email</Label>
            <Input
              id="register-email"
              type="email"
              value={state.email}
              onChange={(event) => setState((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>
          <Button color="primary" type="submit" className="w-full rounded-none" isLoading={isSubmitting}>
            Enviar codigo
          </Button>
        </>
      ) : step === "validate-code" ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="register-code">Codigo de verificacion</Label>
            <Input
              id="register-code"
              value={state.code}
              onChange={(event) => setState((prev) => ({ ...prev, code: event.target.value }))}
            />
            <p className="font-mono text-xs text-muted-foreground">
              Te enviamos un codigo a {state.email}
            </p>
          </div>
          <Button color="primary" type="submit" className="w-full rounded-none" isLoading={isSubmitting}>
            Validar codigo
          </Button>
          <Button
            variant="light"
            type="button"
            className="w-full rounded-none"
            onPress={onResendCode}
            isLoading={registerRequestCodeMutation.isPending}
          >
            Reenviar codigo
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="register-password">Crea tu contraseña</Label>
            <Input
              id="register-password"
              type="password"
              value={state.password}
              onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Tu codigo ya fue validado correctamente</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="register-confirm-password">Confirma tu contraseña</Label>
            <Input
              id="register-confirm-password"
              type="password"
              value={state.confirmPassword}
              onChange={(event) =>
                setState((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
            />
          </div>
          <Button color="primary" type="submit" className="w-full rounded-none" isLoading={isSubmitting}>
            Crear cuenta
          </Button>
        </>
      )}

      <p className="text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
