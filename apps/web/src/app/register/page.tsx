import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
          <p className="text-muted-foreground text-sm">Loading…</p>
        </main>
      }
    >
      <AuthForm mode="register" />
    </Suspense>
  );
}
