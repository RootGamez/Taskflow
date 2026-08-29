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
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded border-2 border-dashed border-border p-8 text-center">
      <span className="boxed-icon h-12 w-12 border-dashed text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-base font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? (
        <Button className="mt-4 rounded-none" color="primary" onPress={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
