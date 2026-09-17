import { Suspense } from "react";
import ApplicationsClient from "./ApplicationsClient";

export default function ApplicationsPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
          <p className="text-muted-foreground text-sm">Loading your applications…</p>
        </main>
      }
    >
      <ApplicationsClient />
    </Suspense>
  );
}
