import { Button, Card, Input } from "@heroui/react";
import { User } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { apiClient } from "@/lib/axios";
import { useAuthStore } from "@/store/authStore";

export function UserProfilePage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const response = await apiClient.patch("/users/me/", {
        full_name: fullName,
      });

      setUser(response.data);
      toast.success("Perfil actualizado correctamente");
    } catch (error) {
      toast.error("Error al actualizar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectAvatar = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setIsUploadingAvatar(true);
    try {
      const response = await apiClient.post("/users/me/avatar/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUser(response.data);
      setAvatarUrl(response.data.avatar_url ?? "");
      toast.success("Foto de perfil actualizada");
    } catch {
      toast.error("No se pudo subir la foto de perfil");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Foto de perfil</label>
            <div className="mt-2 flex items-center gap-3">
              <img
                src={avatarUrl || undefined}
                alt="Avatar preview"
                className="h-14 w-14 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
              />
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <Button size="sm" variant="flat" onPress={handleSelectAvatar} isLoading={isUploadingAvatar}>
                  Subir foto
                </Button>
                <p className="mt-1 text-xs text-zinc-500">JPG, PNG, WEBP o GIF. Max 5MB.</p>
              </div>
            </div>
          </div>

          <Button color="primary" onPress={handleSave} isLoading={isSaving}>
            Guardar cambios
          </Button>
        </div>
      </Card>
    </div>
  );
}
