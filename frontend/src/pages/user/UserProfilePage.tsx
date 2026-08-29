import { Button } from "@heroui/react";
import { User } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
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
      <div className="border-b-2 border-border pb-4">
        <p className="eyebrow mb-1">Cuenta</p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-foreground">
          <span className="boxed-icon h-8 w-8">
            <User className="h-4 w-4" />
          </span>
          Mi Perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Administra la información de tu perfil</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={user?.email ?? ""} disabled />
          <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-full-name">Nombre completo</Label>
          <Input
            id="profile-full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>

        <div className="space-y-1.5 border-t-2 border-border pt-4">
          <Label>Foto de perfil</Label>
          <div className="mt-2 flex items-center gap-3">
            <img
              src={avatarUrl || undefined}
              alt="Avatar preview"
              className="h-14 w-14 rounded-full border-2 border-border object-cover"
            />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                size="sm"
                variant="flat"
                className="rounded-none"
                onPress={handleSelectAvatar}
                isLoading={isUploadingAvatar}
              >
                Subir foto
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP o GIF. Max 5MB.</p>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-border pt-4">
          <Button color="primary" className="rounded-none" onPress={handleSave} isLoading={isSaving}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
