import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
