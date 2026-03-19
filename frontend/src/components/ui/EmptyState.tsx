import { Button } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <Icon className="h-12 w-12 text-zinc-300" />
      <h3 className="mt-4 text-base font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      {action ? (
        <Button className="mt-4" color="primary" onPress={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
