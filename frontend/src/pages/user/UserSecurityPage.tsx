import { Button, Card, Input } from "@heroui/react";
import { Trash2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { apiClient } from "@/lib/axios";

interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  last_activity: string;
  is_current: boolean;
}

export function UserSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Cargar sesiones
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const response = await apiClient.get("/users/me/sessions/");
        setSessions(response.data);
      } catch (error) {
        toast.error("Error al cargar sesiones");
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadSessions();
  }, []);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Completa todos los campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsChanging(true);
    try {
      await apiClient.post("/users/me/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Error al cambiar contraseña");
    } finally {
      setIsChanging(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/users/me/sessions/${sessionId}/`);

      setSessions(sessions.filter((s) => s.id !== sessionId));
      toast.success("Sesión revocada");
    } catch (error) {
      toast.error("Error al revocar sesión");
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      await apiClient.post("/users/me/sessions/revoke-others/");

      setSessions(sessions.filter((s) => s.is_current));
      toast.success("Todas las otras sesiones fueron revocadas");
    } catch (error) {
      toast.error("Error al revocar sesiones");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold dark:text-zinc-50">
          <Shield className="h-6 w-6" />
          Seguridad
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Gestiona tu contraseña y sesiones activas</p>
      </div>

      {/* Cambio de contraseña */}
      <Card className="p-6 dark:bg-zinc-800">
        <h2 className="mb-4 text-lg font-semibold dark:text-zinc-50">Cambiar contraseña</h2>
        <div className="space-y-4">
          <Input
            type="password"
            label="Contraseña actual"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Tu contraseña actual"
          />
          <Input
            type="password"
            label="Nueva contraseña"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
          />
          <Input
            type="password"
            label="Confirmar contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirma tu nueva contraseña"
          />
          <Button color="primary" onPress={handleChangePassword} isLoading={isChanging}>
            Actualizar contraseña
          </Button>
        </div>
      </Card>

      {/* Sesiones activas */}
      <Card className="p-6 dark:bg-zinc-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-zinc-50">Sesiones activas</h2>
          {sessions.length > 1 && (
            <Button size="sm" variant="flat" onPress={handleRevokeAllOtherSessions}>
              Revocar otras sesiones
            </Button>
          )}
        </div>

        {isLoadingSessions ? (
          <p className="text-sm text-zinc-500">Cargando sesiones...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No hay sesiones activas</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {session.user_agent} {session.is_current && <span className="text-xs text-blue-500">(Esta sesión)</span>}
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    IP: {session.ip_address} • Última actividad: {new Date(session.last_activity).toLocaleString()}
                  </p>
                </div>
                {!session.is_current && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => handleRevokeSession(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
