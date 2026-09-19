"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ThemeToggle from "./ThemeToggle";

const navigation = [
  { href: "/", label: "Home", exact: true },
  { href: "/todo", label: "Today" },
  { href: "/interviews", label: "Interviews" },
  { href: "/jobs", label: "Jobs" },
  { href: "/applications", label: "Applications" },
  { href: "/resumes", label: "Resumes" },
  { href: "/sources", label: "Sources" },
] as const;

const AUTH_PAGES = new Set(["/login", "/register", "/forgot-password", "/reset-password"]);

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  /*
   * Close the mobile menu when the route changes.
   */
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsMenuOpen(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  /*
   * Close the mobile menu when clicking outside.
   */
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  /*
   * Close the mobile menu when pressing Escape.
   */
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

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
      setIsMenuOpen(false);
    }
  }

  return (
    <header className="border-border bg-card/95 relative z-[100] border-b backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="text-foreground hover:text-primary focus-visible:ring-primary focus-visible:ring-offset-background shrink-0 text-lg font-bold tracking-tight transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          CareerNeed
        </Link>

        {user ? (
          <>
            {/* Desktop Navigation */}
            <nav
              className="hidden min-w-0 flex-1 items-center gap-1 md:flex"
              aria-label="Primary navigation"
            >
              {navigation.map((item) => {
                const active = isActivePath(pathname, item.href, "exact" in item && item.exact);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`focus-visible:ring-primary shrink-0 rounded-md px-2.5 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset ${
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

            {/* Mobile / Tablet Navigation */}
            <div ref={menuRef} className="relative ml-auto md:hidden">
              <button
                type="button"
                aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-navigation"
                onClick={() => setIsMenuOpen((open) => !open)}
                className="text-foreground hover:bg-muted focus-visible:ring-primary rounded-md p-2 transition focus-visible:ring-2 focus-visible:outline-none"
              >
                {isMenuOpen ? (
                  /* X icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                ) : (
                  /* Hamburger icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>

              {isMenuOpen && (
                <div
                  id="mobile-navigation"
                  className="border-border bg-card absolute top-full right-0 z-[110] mt-2 w-64 overflow-hidden rounded-lg border shadow-lg"
                >
                  {/* Navigation items */}
                  <nav className="p-2" aria-label="Mobile navigation">
                    {navigation.map((item) => {
                      const active = isActivePath(
                        pathname,
                        item.href,
                        "exact" in item && item.exact
                      );

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setIsMenuOpen(false)}
                          className={`focus-visible:ring-primary block rounded-md px-3 py-2.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none ${
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

                  {/* User section */}
                  <div className="border-border border-t p-2">
                    <div
                      className="text-muted-foreground mb-1 truncate px-3 py-2 text-xs"
                      title={user.email}
                    >
                      {user.email}
                    </div>

                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="text-foreground hover:bg-muted focus-visible:ring-primary w-full rounded-md px-3 py-2.5 text-left text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoggingOut ? "Signing out…" : "Log out"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right side */}
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              {/* Desktop user info */}
              <span
                className="text-muted-foreground hidden max-w-44 truncate text-sm lg:block"
                title={user.email}
              >
                {user.email}
              </span>

              {/* Desktop logout */}
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary hidden rounded-md border px-3 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-60 md:block"
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
