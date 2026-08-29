import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Keyboard, LogOut, Settings, Shield, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MemberAvatar } from "@/features/members/components/MemberAvatar";
import { useShortcutsHelpDialogStore } from "@/features/shortcuts/store/shortcutsHelpDialogStore";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/features/auth/types/auth.types";

interface UserMenuProps {
  user: User | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  // WP-D (§7 de docs/PHASE_3_PLAN.md): mismo store que
  // `GlobalShortcutsProvider`/`KeyboardShortcutsDialog` -- una segunda
  // forma de abrir el mismo panel de ayuda que el atajo `?`.
  const openShortcutsDialog = useShortcutsHelpDialogStore((state) => state.open);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Dropdown
      // Lenguaje de sello/borde (docs/BRUTALIST_REDESIGN_PLAN.md §13.2.7):
      // borde 2px en tinta, sombra dura sin blur, esquinas casi rectas.
      classNames={{
        content:
          "min-w-[13rem] rounded-none border-2 border-border bg-card p-1 shadow-hard dark:shadow-hard-float",
      }}
    >
      <DropdownTrigger asChild>
        <Button isIconOnly className="h-10 w-10 rounded-full" variant="light" size="sm">
          {user ? (
            <MemberAvatar user={user} size="sm" showTooltip={false} />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-secondary text-muted-foreground">
              <UserIcon className="h-4 w-4" />
            </span>
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="User menu"
        variant="flat"
        itemClasses={{ base: "rounded-none data-[hover=true]:bg-accent" }}
      >
        <DropdownItem key="profile" startContent={<UserIcon className="h-4 w-4" />} onPress={() => navigate("/settings/profile")}>
          Mi perfil
        </DropdownItem>
        <DropdownItem key="security" startContent={<Shield className="h-4 w-4" />} onPress={() => navigate("/settings/security")}>
          Seguridad
        </DropdownItem>
        <DropdownItem key="settings" startContent={<Settings className="h-4 w-4" />} onPress={() => navigate("/settings/account")}>
          Configuración
        </DropdownItem>
        <DropdownItem key="shortcuts" startContent={<Keyboard className="h-4 w-4" />} onPress={openShortcutsDialog}>
          Atajos de teclado
        </DropdownItem>
        <DropdownItem key="logout" color="danger" className="text-destructive" startContent={<LogOut className="h-4 w-4" />} onPress={handleLogout}>
          Cerrar sesión
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
