import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </main>
      }
    >
      <AuthForm mode="login" />
    </Suspense>
  );
}
