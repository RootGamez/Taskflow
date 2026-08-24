import { Button, Card, Switch } from "@heroui/react";
import { Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

export function UserAccountPage() {
  const user = useAuthStore((state) => state.user);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleSaveNotifications = async () => {
    try {
      await apiClient.patch("/users/me/preferences/", {
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
      });

      toast.success("Preferencias guardadas");
    } catch (error) {
      toast.error("Error al guardar preferencias");
    }
  };

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
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold dark:text-zinc-50">
          <Settings className="h-6 w-6" />
          Configuración de cuenta
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Gestiona las preferencias de tu cuenta</p>
      </div>

      {/* Información de la cuenta */}
      <Card className="p-6 dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-semibold dark:text-zinc-50">Información de tu cuenta</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Email</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Nombre</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{user?.full_name}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Cuenta creada</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-50">{new Date(user?.created_at ?? "").toLocaleDateString()}</span>
          </div>
        </div>
      </Card>

      {/* Preferencias de notificaciones */}
      <Card className="p-6 dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-semibold dark:text-zinc-50">Notificaciones</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">Notificaciones por email</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Recibe actualizaciones por email</p>
            </div>
            <Switch isSelected={emailNotifications} onValueChange={setEmailNotifications} />
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">Notificaciones push</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Recibe notificaciones del navegador</p>
            </div>
            <Switch isSelected={pushNotifications} onValueChange={setPushNotifications} />
          </div>
          <Button color="primary" onPress={handleSaveNotifications} className="mt-4">
            Guardar preferencias
          </Button>
        </div>
      </Card>

      {/* Zona de peligro */}
      <Card className="border-red-200 p-6 dark:border-red-900 dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-semibold text-red-600 dark:text-red-400">Zona de peligro</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Una vez que desactives tu cuenta, no hay vuelta atrás. Por favor, asegúrate de que esto es lo que deseas.
        </p>
        <Button color="danger" onPress={handleDeactivateAccount}>
          Desactivar cuenta
        </Button>
      </Card>
    </div>
  );
}
