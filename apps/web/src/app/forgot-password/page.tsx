import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="text-primary size-4 animate-spin" />
            <span>Loading workspace…</span>
          </div>
        </main>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
