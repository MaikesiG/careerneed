import Link from "next/link";

type DashboardSummary = {
  follow_ups_due_today: number;
  follow_ups_overdue: number;
  applications_saved: number;
  applications_applied: number;
  applications_interviewing: number;
  active_applications: number;
};

type DashboardCard = {
  title: string;
  description: string;
  value: number;
  href: string;
  tone: "primary" | "warning" | "danger" | "neutral";
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

function isDashboardSummary(value: unknown): value is DashboardSummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const summary = value as Record<string, unknown>;
  const keys: (keyof DashboardSummary)[] = [
    "follow_ups_due_today",
    "follow_ups_overdue",
    "applications_saved",
    "applications_applied",
    "applications_interviewing",
    "active_applications",
  ];

  return keys.every((key) => typeof summary[key] === "number" && summary[key] >= 0);
}

async function getDashboardSummary(): Promise<DashboardSummary | null> {
  try {
    const response = await fetch(`${API_URL}/dashboard/summary`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    return isDashboardSummary(data) ? data : null;
  } catch {
    return null;
  }
}

function cardToneClass(tone: DashboardCard["tone"]): string {
  if (tone === "warning") {
    return "border-warning-border bg-warning-background hover:border-warning";
  }

  if (tone === "danger") {
    return "border-error-border bg-error-background hover:border-destructive";
  }

  if (tone === "primary") {
    return "border-primary/40 bg-primary/10 hover:border-primary";
  }

  return "border-border bg-card hover:border-primary/50 hover:bg-muted";
}

export default async function Home() {
  const summary = await getDashboardSummary();

  const dashboardCards: DashboardCard[] = summary
    ? [
        {
          title: "Follow-ups due today",
          description: "Keep today’s outreach and check-ins moving.",
          value: summary.follow_ups_due_today,
          href: "/applications?follow_up=today",
          tone: "warning",
        },
        {
          title: "Overdue follow-ups",
          description: "Review roles that need your attention.",
          value: summary.follow_ups_overdue,
          href: "/applications?follow_up=overdue",
          tone: "danger",
        },
        {
          title: "Applied",
          description: "Applications currently submitted.",
          value: summary.applications_applied,
          href: "/applications?status=applied",
          tone: "primary",
        },
        {
          title: "Interviewing",
          description: "Roles progressing through interviews.",
          value: summary.applications_interviewing,
          href: "/applications?status=interviewing",
          tone: "primary",
        },
        {
          title: "Saved jobs",
          description: "Opportunities you may want to pursue.",
          value: summary.applications_saved,
          href: "/applications?status=saved",
          tone: "neutral",
        },
      ]
    : [];

  return (
    <main className="bg-background text-foreground min-h-full px-6 py-10 sm:px-8 sm:py-16">
      <section className="mx-auto max-w-6xl">
        <header className="border-border flex flex-col justify-between gap-6 border-b pb-10 sm:flex-row sm:items-start">
          <div>
            <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              CareerNeed
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
              Your job-search workspace.
            </h1>
            <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-8">
              Discover relevant roles, keep every opportunity in one place, and follow through on
              the applications that matter.
            </p>
          </div>

          <Link
            href="/jobs/add"
            className="bg-primary text-primary-foreground inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition hover:opacity-90"
          >
            Add a job
          </Link>
        </header>

        <section className="mt-10" aria-labelledby="today-heading">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-primary text-sm font-medium">Today</p>
              <h2 id="today-heading" className="mt-1 text-2xl font-semibold">
                Keep your search moving
              </h2>
            </div>

            {summary ? (
              <Link
                href="/applications"
                className="text-primary text-sm font-semibold transition hover:opacity-80"
              >
                View all applications <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>

          {summary ? (
            <>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {dashboardCards.map((card) => (
                  <Link
                    key={card.title}
                    href={card.href}
                    className={`group rounded-2xl border p-5 transition ${cardToneClass(card.tone)}`}
                  >
                    <p className="text-3xl font-bold tracking-tight">{card.value}</p>
                    <h3 className="group-hover:text-primary mt-4 text-base font-semibold">
                      {card.title}
                    </h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {card.description}
                    </p>
                  </Link>
                ))}
              </div>

              <article className="border-border bg-card mt-4 rounded-2xl border p-5 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-primary text-sm font-medium">Active applications</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Submitted or interviewing roles currently in progress.
                  </p>
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight sm:mt-0">
                  {summary.active_applications}
                </p>
              </article>
            </>
          ) : (
            <article className="border-border bg-card mt-5 rounded-2xl border border-dashed p-6">
              <h3 className="text-lg font-semibold">Your dashboard is temporarily unavailable</h3>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                We could not load your application summary. You can still browse jobs, manage
                resumes, and view applications while the API reconnects.
              </p>
              <Link
                href="/applications"
                className="text-primary mt-4 inline-flex text-sm font-semibold transition hover:opacity-80"
              >
                View applications <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </article>
          )}
        </section>

        <section className="mt-10" aria-labelledby="workspace-heading">
          <p className="text-primary text-sm font-medium">Workspace</p>
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
                <p className="text-primary text-sm font-semibold">{action.number}</p>
                <h3 className="mt-4 text-xl font-semibold">{action.title}</h3>
                <p className="text-muted-foreground mt-2 min-h-12 text-sm leading-6">
                  {action.description}
                </p>
                <span className="text-foreground group-hover:text-primary mt-6 inline-flex text-sm font-medium">
                  {action.label} <span aria-hidden="true">&nbsp;→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="border-border bg-card mt-10 rounded-2xl border p-6 sm:p-8"
          aria-labelledby="workflow-heading"
        >
          <p className="text-primary text-sm font-medium">Quick start</p>
          <h2 id="workflow-heading" className="mt-1 text-2xl font-semibold">
            A simple loop for your search
          </h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {workflow.map((step, index) => (
              <li key={step} className="text-muted-foreground flex gap-3 text-sm leading-6">
                <span className="bg-muted text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
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
