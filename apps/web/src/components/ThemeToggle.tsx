"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

type ThemeOption = "light" | "dark" | "system";

const options: Array<{
  value: ThemeOption;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const activeTheme = (theme ?? "system") as ThemeOption;
  const TriggerIcon =
    activeTheme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  const triggerLabel = mounted
    ? `Theme: ${activeTheme}. Change theme`
    : "Change theme";

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={triggerLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={triggerLabel}
        className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-9 items-center justify-center rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <TriggerIcon className="size-4" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Color theme"
          className="border-border bg-card absolute right-0 z-50 mt-2 w-36 rounded-xl border p-1 shadow-lg"
        >
          {options.map(({ value, label, Icon }) => {
            const isSelected = activeTheme === value;

            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setTheme(value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
