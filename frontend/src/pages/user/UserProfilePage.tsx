import { Button, Card, Input } from "@heroui/react";
import { User } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

export function UserProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const response = await apiClient.patch("/users/me/", {
        full_name: fullName,
        avatar_url: avatarUrl,
      });

      setUser(response.data);
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      toast.error("Error al actualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold dark:text-zinc-50">
          <User className="h-6 w-6" />
          Mi Perfil
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Administra la información de tu perfil</p>
      </div>

      <Card className="p-6 dark:bg-zinc-800">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
            <Input value={user?.email ?? ""} isDisabled className="mt-1" />
            <p className="mt-1 text-xs text-zinc-500">El email no se puede cambiar</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nombre completo</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Tu nombre"
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">URL de avatar</label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://ejemplo.com/avatar.jpg"
              type="url"
              className="mt-1"
            />
            {avatarUrl && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-zinc-600 dark:text-zinc-400">Vista previa:</span>
                <img src={avatarUrl} alt="Avatar preview" className="h-10 w-10 rounded-full object-cover" />
              </div>
            )}
          </div>

          <Button color="primary" onPress={handleSave} isLoading={isSaving}>
            Guardar cambios
          </Button>
        </div>
      </Card>
    </div>
  );
}
