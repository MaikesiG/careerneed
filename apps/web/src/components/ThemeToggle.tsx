"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const options = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const subscribe = () => () => {};

function getServerSnapshot() {
  return false;
}

function getClientSnapshot() {
  return true;
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  if (!mounted) {
    return <div className="h-9 w-48" aria-hidden="true" />;
  }

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm"
      aria-label="Color theme"
      role="group"
    >
      {options.map((option) => {
        const isSelected = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            aria-pressed={isSelected}
            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm ${
              isSelected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
