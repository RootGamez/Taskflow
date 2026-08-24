import { Avatar, Tooltip } from "@heroui/react";

import type { User } from "@/features/auth/types/auth.types";

interface MemberAvatarProps {
  user: User;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

function colorFromId(id: string) {
  const colors = ["#2563EB", "#7C3AED", "#DC2626", "#0891B2", "#16A34A", "#EA580C"];
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MemberAvatar({ user, size = "md", showTooltip = false }: MemberAvatarProps) {
  const avatar = (
    <Avatar
      src={user.avatar_url ?? undefined}
      name={initials(user.full_name)}
      size={size}
      className="text-white"
      style={{ backgroundColor: colorFromId(user.id) }}
    />
  );

  if (!showTooltip) {
    return avatar;
  }

  return <Tooltip content={user.full_name}>{avatar}</Tooltip>;
}
