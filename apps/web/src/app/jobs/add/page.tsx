import Link from "next/link";
import ManualJobForm from "./ManualJobForm";

export default function AddJobPage() {
  return (
    <main className="bg-background text-foreground min-h-full px-6 py-10 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-3xl">
        <Link
          href="/jobs"
          className="text-primary inline-flex text-sm font-medium transition hover:opacity-80"
        >
          ← Back to jobs
        </Link>

        <header className="mt-8">
          <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
            Manual job entry
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Add a job</h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
            Found a role on LinkedIn, a company career page, or through your network? Add it here so
            it appears alongside your synced opportunities.
          </p>
        </header>

        <div className="border-border bg-card mt-10 rounded-2xl border p-6 sm:p-8">
          <ManualJobForm />
        </div>
      </section>
    </main>
  );
}
