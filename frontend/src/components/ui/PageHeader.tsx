import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Etiqueta de sección en mayúsculas sobre el título. */
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-3 border-b-2 border-border pb-4 md:flex-row md:items-end">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="font-display text-fluid-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
