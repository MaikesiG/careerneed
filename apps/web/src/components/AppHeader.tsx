"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ThemeToggle from "./ThemeToggle";

const navigation = [
  { href: "/", label: "Home", exact: true },
  { href: "/todo", label: "To Do" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/resumes", label: "Resumes" },
  { href: "/sources", label: "Sources" },
] as const;

const AUTH_PAGES = new Set(["/login", "/register"]);

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
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (AUTH_PAGES.has(pathname)) {
    return null;
  }

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="border-border bg-card/95 border-b backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-foreground hover:text-primary focus-visible:ring-primary focus-visible:ring-offset-background shrink-0 text-lg font-bold tracking-tight transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          CareerNeed
        </Link>

        {user ? (
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
                  className={`focus-visible:ring-primary rounded-md px-2.5 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${
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
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <span
                className="text-muted-foreground hidden max-w-44 truncate text-sm sm:block"
                title={user.email}
              >
                {user.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? "Signing out…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-primary rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background rounded-md px-3 py-2 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Create account
              </Link>
            </>
          )}

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
