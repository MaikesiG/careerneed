import Link from "next/link";

const actions = [
  {
    number: "01",
    title: "Manage resumes",
    description: "Upload, review, and choose the resume that represents you best.",
    href: "/resumes",
    label: "Go to resumes",
  },
  {
    number: "02",
    title: "Browse jobs",
    description: "Search, filter, and compare opportunities from your job pool.",
    href: "/jobs",
    label: "Browse jobs",
  },
  {
    number: "03",
    title: "Applications",
    description: "Track applications, notes, outcomes, and follow-up dates.",
    href: "/applications",
    label: "View applications",
  },
  {
    number: "04",
    title: "Add a job",
    description: "Save an opportunity you found on a company site, LinkedIn, or elsewhere.",
    href: "/jobs/add",
    label: "Add a manual job",
    featured: true,
  },
  {
    number: "05",
    title: "Manage sources",
    description: "Add target companies and manage the job boards you sync from.",
    href: "/sources",
    label: "Manage sources",
  },
];

const workflow = [
  "Add a resume so CareerNeed can evaluate job relevance.",
  "Browse synced roles or add an opportunity you found yourself.",
  "Save a role, mark it applied, and record your next follow-up.",
];

export default function Home() {
  return (
    <main className="min-h-full bg-background px-6 py-10 text-foreground sm:px-8 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-6 border-b border-border pb-10 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              CareerNeed
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
              Your job-search workspace.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Discover relevant roles, keep every opportunity in one place, and follow through on
              the applications that matter.
            </p>
          </div>

          <Link
            href="/jobs/add"
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Add a job
          </Link>
        </header>

        <section className="mt-10" aria-labelledby="workspace-heading">
          <p className="text-sm font-medium text-primary">Workspace</p>
          <h2 id="workspace-heading" className="mt-1 text-2xl font-semibold">
            What do you want to do?
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`group rounded-2xl border p-6 transition ${
                  action.featured
                    ? "border-primary/60 bg-primary/10 hover:border-primary hover:bg-primary/15"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <p className="text-sm font-semibold text-primary">{action.number}</p>
                <h3 className="mt-4 text-xl font-semibold">{action.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                  {action.description}
                </p>
                <span className="mt-6 inline-flex text-sm font-medium text-foreground group-hover:text-primary">
                  {action.label} <span aria-hidden="true">&nbsp;→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8"
          aria-labelledby="workflow-heading"
        >
          <p className="text-sm font-medium text-primary">Quick start</p>
          <h2 id="workflow-heading" className="mt-1 text-2xl font-semibold">
            A simple loop for your search
          </h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {workflow.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </main>
  );
}
