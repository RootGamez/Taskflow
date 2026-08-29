import { Button } from "@heroui/react";
import { Trash2, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/shadcn/badge";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
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
      <div className="border-b-2 border-border pb-4">
        <p className="eyebrow mb-1">Cuenta</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
          <span className="boxed-icon h-8 w-8">
            <Shield className="h-4 w-4" />
          </span>
          Seguridad
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestiona tu contraseña y sesiones activas</p>
      </div>

      {/* Cambio de contraseña */}
      <section className="space-y-4">
        <p className="eyebrow text-foreground">Cambiar contraseña</p>
        <div className="space-y-1.5">
          <Label htmlFor="security-current-password">Contraseña actual</Label>
          <Input
            id="security-current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Tu contraseña actual"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="security-new-password">Nueva contraseña</Label>
          <Input
            id="security-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="security-confirm-password">Confirmar contraseña</Label>
          <Input
            id="security-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirma tu nueva contraseña"
          />
        </div>
        <Button color="primary" className="rounded-none" onPress={handleChangePassword} isLoading={isChanging}>
          Actualizar contraseña
        </Button>
      </section>

      {/* Sesiones activas */}
      <section className="space-y-4 border-t-2 border-border pt-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-foreground">Sesiones activas</p>
          {sessions.length > 1 && (
            <Button size="sm" variant="flat" className="rounded-none" onPress={handleRevokeAllOtherSessions}>
              Revocar otras sesiones
            </Button>
          )}
        </div>

        {isLoadingSessions ? (
          <p className="text-sm text-muted-foreground">Cargando sesiones...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay sesiones activas</p>
        ) : (
          <ul className="divide-y-2 divide-border border-2 border-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <span className="truncate">{session.user_agent}</span>
                    {session.is_current && (
                      <Badge variant="primary" mono>
                        Esta sesión
                      </Badge>
                    )}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    IP: {session.ip_address} • Última actividad:{" "}
                    {new Date(session.last_activity).toLocaleString()}
                  </p>
                </div>
                {!session.is_current && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    className="rounded-none"
                    aria-label="Revocar sesión"
                    onPress={() => handleRevokeSession(session.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
