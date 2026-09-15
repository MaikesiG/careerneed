import Link from "next/link";

type HomeDestination = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  featured?: boolean;
};

const destinations: HomeDestination[] = [
  {
    eyebrow: "Daily focus",
    title: "To Do",
    description: "See the follow-ups and applications that need your attention now.",
    href: "/todo",
    label: "Open To Do",
    featured: true,
  },
  {
    eyebrow: "Discover",
    title: "Jobs",
    description: "Browse, filter, and compare opportunities from your job pool.",
    href: "/jobs",
    label: "Browse jobs",
  },
  {
    eyebrow: "Track",
    title: "Applications",
    description: "Keep each role, status, note, and follow-up in one place.",
    href: "/applications",
    label: "View applications",
  },
  {
    eyebrow: "Prepare",
    title: "Resumes",
    description: "Manage the resume versions you use for different opportunities.",
    href: "/resumes",
    label: "Manage resumes",
  },
  {
    eyebrow: "Connect",
    title: "Sources",
    description: "Manage target companies and the job boards you sync from.",
    href: "/sources",
    label: "Manage sources",
  },
];

const workflowSteps = [
  {
    number: "01",
    title: "Discover",
    description: "Browse relevant roles from your job pool.",
  },
  {
    number: "02",
    title: "Track",
    description: "Save opportunities and keep each application organized.",
  },
  {
    number: "03",
    title: "Follow through",
    description: "Handle follow-ups and move the pipeline forward.",
  },
];

export default function Home() {
  return (
    <main className="bg-background text-foreground min-h-full overflow-hidden">
      <section className="border-border relative isolate border-b">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,oklch(from_var(--primary)_l_c_h_/_0.22),transparent_38%),radial-gradient(circle_at_84%_38%,oklch(from_var(--primary)_l_c_h_/_0.16),transparent_32%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom,black,transparent_88%)] [background-size:4rem_4rem] opacity-40"
        />

        <div className="mx-auto grid min-h-[34rem] max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-primary text-sm font-semibold tracking-[0.22em] uppercase">
              CareerNeed workspace
            </p>

            <h1 className="mt-5 text-5xl font-bold tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Turn every opportunity into your next move.
            </h1>

            <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8 sm:text-xl">
              Find the right roles, keep every application moving, and never lose the next follow-up
              that matters.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/todo"
                className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition hover:scale-[1.02] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Open To Do <span aria-hidden="true">&nbsp;→</span>
              </Link>

              <Link
                href="/jobs"
                className="border-border bg-card/70 text-foreground hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center justify-center rounded-lg border px-5 py-3 text-sm font-semibold backdrop-blur transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Browse jobs
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end">
            <div
              aria-hidden="true"
              className="bg-primary/15 absolute -inset-5 -z-10 rounded-[2rem] blur-3xl"
            />

            <div className="border-border bg-card/90 rounded-[1.75rem] border p-5 shadow-2xl backdrop-blur sm:p-6">
              <div className="border-border flex items-center justify-between gap-4 border-b pb-5">
                <div>
                  <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    Your next move
                  </p>
                  <p className="mt-1 text-lg font-semibold">A focused job search</p>
                </div>
                <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full text-lg">
                  →
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <div className="border-warning-border bg-warning-background rounded-xl border p-4">
                  <p className="text-warning text-xs font-semibold tracking-[0.14em] uppercase">
                    To Do
                  </p>
                  <p className="mt-2 font-semibold">Follow up with the roles that matter.</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Keep your momentum without losing track.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="border-border bg-background rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">Discover</p>
                    <p className="mt-1 text-sm font-semibold">Jobs</p>
                  </div>
                  <div className="border-border bg-background rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">Track</p>
                    <p className="mt-1 text-sm font-semibold">Pipeline</p>
                  </div>
                  <div className="border-border bg-background rounded-xl border p-3">
                    <p className="text-muted-foreground text-xs">Prepare</p>
                    <p className="mt-1 text-sm font-semibold">Resumes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-primary text-sm font-semibold tracking-[0.18em] uppercase">
            One focused workflow
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Make the next step obvious.
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-7">
            CareerNeed brings opportunity discovery, application tracking, follow-ups, and resume
            preparation into one calm workspace.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {workflowSteps.map((step) => (
            <li
              key={step.number}
              className="border-border bg-card relative rounded-2xl border p-6 shadow-sm"
            >
              <p className="text-primary text-sm font-semibold tracking-[0.14em]">{step.number}</p>
              <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-border bg-muted/30 border-t">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-primary text-sm font-semibold tracking-[0.18em] uppercase">
                Explore CareerNeed
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Choose where to start.</h2>
            </div>

            <Link
              href="/todo"
              className="text-primary focus-visible:ring-primary focus-visible:ring-offset-background text-sm font-semibold transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Go to To Do <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((destination) => (
              <Link
                key={destination.href}
                href={destination.href}
                className={`group focus-visible:ring-primary focus-visible:ring-offset-background relative overflow-hidden rounded-2xl border p-6 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  destination.featured
                    ? "border-primary/50 bg-primary/10 hover:border-primary hover:bg-primary/15"
                    : "border-border bg-card hover:border-primary/50 hover:bg-muted"
                }`}
              >
                {destination.featured ? (
                  <span
                    aria-hidden="true"
                    className="bg-primary/15 absolute top-0 right-0 h-24 w-24 translate-x-10 -translate-y-10 rounded-full blur-2xl"
                  />
                ) : null}

                <p className="text-primary relative text-xs font-semibold tracking-[0.16em] uppercase">
                  {destination.eyebrow}
                </p>
                <h3 className="relative mt-4 text-xl font-semibold">{destination.title}</h3>
                <p className="text-muted-foreground relative mt-2 min-h-12 text-sm leading-6">
                  {destination.description}
                </p>
                <span className="text-foreground group-hover:text-primary relative mt-6 inline-flex text-sm font-semibold transition">
                  {destination.label} <span aria-hidden="true">&nbsp;→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
