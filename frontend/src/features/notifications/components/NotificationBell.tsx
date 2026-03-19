import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Bell } from "lucide-react";

import { NotificationList } from "@/features/notifications/components/NotificationList";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";

export function NotificationBell() {
  const { data = [] } = useNotifications();
  const unread = data.filter((item) => !item.is_read).length;

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button isIconOnly variant="light" aria-label="Notificaciones">
          <Badge color="danger" content={unread > 9 ? "9+" : unread} isInvisible={unread === 0}>
            <Bell className="h-4 w-4" />
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <NotificationList />
      </PopoverContent>
    </Popover>
  );
}
