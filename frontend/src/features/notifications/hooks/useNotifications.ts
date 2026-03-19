import { useQuery } from "@tanstack/react-query";

interface NotificationItem {
  id: string;
  text: string;
  created_at: string;
  is_read: boolean;
}

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n-1",
    text: "Te asignaron en Definir arquitectura de notificaciones",
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    is_read: false,
  },
  {
    id: "n-2",
    text: "Ana comentó en ticket de login",
    created_at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    is_read: true,
  },
];

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return MOCK_NOTIFICATIONS;
    },
    initialData: MOCK_NOTIFICATIONS,
  });
}
