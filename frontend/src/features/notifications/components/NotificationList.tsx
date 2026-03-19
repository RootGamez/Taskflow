import { Button } from "@heroui/react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

import { useNotifications } from "@/features/notifications/hooks/useNotifications";

export function NotificationList() {
  const { data = [] } = useNotifications();

  return (
    <div className="w-80 space-y-3 p-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Notificaciones</h4>
        <Button size="sm" variant="light">Marcar todas como leidas</Button>
      </div>
      <div className="space-y-2">
        {data.slice(0, 10).map((notification) => (
          <div key={notification.id} className="rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-800">
            <p className="text-zinc-700 dark:text-zinc-300">{notification.text}</p>
            <p className="text-xs text-zinc-400">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
