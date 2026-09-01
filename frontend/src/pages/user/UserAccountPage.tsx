import { Button } from "@heroui/react";
import { Settings } from "lucide-react";
import { toast } from "react-hot-toast";

import { EmailNotificationPreferences } from "@/features/notifications/components/EmailNotificationPreferences";
import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

export function UserAccountPage() {
  const user = useAuthStore((state) => state.user);

  const handleDeactivateAccount = async () => {
    if (!confirm("¿Estás seguro? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      await apiClient.post("/users/me/deactivate/");

      toast.success("Cuenta desactivada");
      // Redirigir al login
      window.location.href = "/login";
    } catch (error) {
      toast.error("Error al desactivar cuenta");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-border pb-4">
        <p className="eyebrow mb-1">Cuenta</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
          <span className="boxed-icon h-8 w-8">
            <Settings className="h-4 w-4" />
          </span>
          Configuración de cuenta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestiona las preferencias de tu cuenta</p>
      </div>

      {/* Información de la cuenta */}
      <section className="space-y-3">
        <p className="eyebrow text-foreground">Información de tu cuenta</p>
        <dl className="divide-y-2 divide-border border-2 border-border">
          <div className="flex items-center justify-between gap-3 bg-card px-3 py-2.5">
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="font-mono text-sm font-medium text-foreground">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 bg-card px-3 py-2.5">
            <dt className="text-sm text-muted-foreground">Nombre</dt>
            <dd className="text-sm font-medium text-foreground">{user?.full_name}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 bg-card px-3 py-2.5">
            <dt className="text-sm text-muted-foreground">Cuenta creada</dt>
            <dd className="font-mono text-sm font-medium text-foreground">
              {new Date(user?.created_at ?? "").toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </section>

      {/* Preferencias de correo. Cada switch se guarda solo, sin botón. */}
      <EmailNotificationPreferences email={user?.email} />

      {/* Zona de peligro */}
      <section className="space-y-3 border-2 border-destructive bg-destructive/5 p-4">
        <p className="eyebrow text-destructive">Zona de peligro</p>
        <p className="text-sm text-foreground">
          Una vez que desactives tu cuenta, no hay vuelta atrás. Por favor, asegúrate de que esto es
          lo que deseas.
        </p>
        <Button color="danger" className="rounded-none" onPress={handleDeactivateAccount}>
          Desactivar cuenta
        </Button>
      </section>
    </div>
  );
}
