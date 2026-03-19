import { useQuery } from "@tanstack/react-query";

import type { User } from "@/features/auth/types/auth.types";

const MOCK_MEMBERS: User[] = [
  {
    id: "u-1",
    email: "demo@taskflow.app",
    full_name: "Demo User",
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "u-2",
    email: "ana@taskflow.app",
    full_name: "Ana Rivera",
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return MOCK_MEMBERS;
    },
    initialData: MOCK_MEMBERS,
  });
}
