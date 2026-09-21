"use client";

import { useState, type ReactNode } from "react";

export type InterviewDisclosureSectionProps = {
  id: string;
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  className?: string;
};

export default function InterviewDisclosureSection({
  id,
  title,
  badge,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  children,
  className = "",
}: InterviewDisclosureSectionProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(defaultOpen);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;

  const handleToggle = () => {
    if (isControlled) {
      controlledOnToggle?.();
    } else {
      setUncontrolledIsOpen((prev) => !prev);
    }
  };

  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;

  return (
    <div className={`border-border bg-card/40 rounded-xl border transition-colors ${className}`}>
      <button
        id={triggerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={handleToggle}
        className={`focus-visible:ring-primary focus-visible:ring-offset-background hover:bg-muted/40 flex min-h-10 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:px-4 ${
          isOpen ? "rounded-t-xl" : "rounded-xl"
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate">{title}</span>
          {badge}
        </span>
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium">
          <span>{isOpen ? "Hide" : "Show"}</span>
          <span aria-hidden="true" className="text-base leading-none">
            {isOpen ? "▴" : "▾"}
          </span>
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!isOpen}
        className={
          !isOpen ? "hidden" : "border-border/60 border-t px-3.5 pt-1 pb-3.5 sm:px-4 sm:pb-4"
        }
      >
        {children}
      </div>
    </div>
  );
}
