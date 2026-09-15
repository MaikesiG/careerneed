import Link from "next/link";
import ManualJobForm from "./ManualJobForm";

export default function AddJobPage() {
  return (
    <main className="min-h-full bg-background px-6 py-10 text-foreground sm:px-8 sm:py-16">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/jobs"
          className="inline-flex text-sm font-medium text-primary transition hover:opacity-80"
        >
          ← Back to jobs
        </Link>

        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Manual job entry
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Add a job</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Found a role on LinkedIn, a company career page, or through your network? Add it here
            so it appears alongside your synced opportunities.
          </p>
        </header>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <ManualJobForm />
        </div>
      </section>
    </main>
  );
}
