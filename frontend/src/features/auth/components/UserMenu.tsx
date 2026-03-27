import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { LogOut, Settings, Shield, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/features/auth/types/auth.types";

interface UserMenuProps {
  user: User | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button isIconOnly className="h-10 w-10 rounded-full" variant="light" size="sm">
          {user ? (
            <MemberAvatar user={user} size="sm" showTooltip={false} />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
              <UserIcon className="h-4 w-4" />
            </span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="User menu" variant="flat">
        <DropdownItem key="profile" startContent={<UserIcon className="h-4 w-4" />} onPress={() => navigate("/settings/profile")}>
          Mi perfil
        </DropdownItem>
        <DropdownItem key="security" startContent={<Shield className="h-4 w-4" />} onPress={() => navigate("/settings/security")}>
          Seguridad
        </DropdownItem>
        <DropdownItem key="settings" startContent={<Settings className="h-4 w-4" />} onPress={() => navigate("/settings/account")}>
          Configuración
        </DropdownItem>
        <DropdownItem key="logout" color="danger" startContent={<LogOut className="h-4 w-4" />} onPress={handleLogout}>
          Cerrar sesión
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
