import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
        {subtitle ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
