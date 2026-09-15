"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const isPublicPath = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    if (!isLoading && !user && !isPublicPath) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isPublicPath, pathname, router, user]);

  if (isLoading && !isPublicPath) {
    return (
      <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
        <p className="text-muted-foreground text-sm">Loading your workspace…</p>
      </main>
    );
  }

  if (!user && !isPublicPath) {
    return null;
  }

  return <>{children}</>;
}
