import { Input } from "@heroui/react";
import { Search } from "lucide-react";
import { useParams } from "react-router-dom";

import { UserMenu } from "@/features/auth/components/UserMenu";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useAuthStore } from "@/store/authStore";

export function Topbar() {
  const { workspaceSlug, projectId } = useParams();
  const user = useAuthStore((state) => state.user);

  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500">
        {workspaceSlug ?? "Workspace"} {projectId ? `› ${projectId} › Tablero` : "› Dashboard"}
      </p>
      <div className="mx-4 hidden max-w-md flex-1 md:block">
        <Input startContent={<Search className="h-4 w-4 text-zinc-400" />} placeholder="Buscar tickets..." variant="bordered" />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
