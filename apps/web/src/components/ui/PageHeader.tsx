import type { ReactNode } from "react";

export type PageHeaderProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
  children,
  className = "",
}: PageHeaderProps) {
  const hasEyebrow = Boolean(eyebrow && eyebrow.trim());

  return (
    <header className={`mb-6 ${className}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 max-w-3xl">
          {hasEyebrow ? (
            <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
              {eyebrow}
            </p>
          ) : null}
          <div className={`${hasEyebrow ? "mt-1 " : ""}flex flex-wrap items-center gap-2 sm:gap-2.5`}>
            {typeof title === "string" ? (
              <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
            ) : (
              title
            )}
            {badge}
          </div>
          {description ? (
            <div className="text-muted-foreground mt-1.5 text-sm sm:text-base leading-relaxed">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:self-end">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
