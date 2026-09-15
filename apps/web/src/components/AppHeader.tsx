"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const navigation = [
  { href: "/", label: "Home", exact: true },
  { href: "/resumes", label: "Resumes" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/sources", label: "Sources" },
] as const;

function isActivePath(
  pathname: string,
  href: (typeof navigation)[number]["href"],
  exact?: boolean
): boolean {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="border-border bg-card/95 border-b backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-foreground hover:text-primary shrink-0 text-lg font-bold tracking-tight transition"
        >
          CareerNeed
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => {
            const active = isActivePath(pathname, item.href, "exact" in item && item.exact);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
