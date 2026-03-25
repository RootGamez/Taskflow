import { Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Bell } from "lucide-react";

import { NotificationList } from "@/features/notifications/components/NotificationList";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";

export function NotificationBell() {
  const { data = [] } = useNotifications();
  const unread = data.filter((item) => !item.is_read).length;
  const unreadLabel = unread > 99 ? "99+" : String(unread);

  return (
    <Popover placement="bottom-end" offset={12}>
      <PopoverTrigger>
        <Button
          isIconOnly
          variant="light"
          aria-label="Notificaciones"
          className="relative h-9 w-9 rounded-xl border border-transparent text-zinc-600 transition hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <Bell className="h-4.5 w-4.5" />

          {unread > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.2rem] items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white shadow-sm dark:border-zinc-900">
              {unreadLabel}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/95 p-0 shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
