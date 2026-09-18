"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch, getApiErrorMessage, UpcomingInterview } from "@/lib/api";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type DashboardSummary = {
  follow_ups_due_today: number;
  follow_ups_overdue: number;
  applications_saved: number;
  applications_applied: number;
  applications_interviewing: number;
  active_applications: number;
};

type DashboardFollowUp = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  follow_up_on: string;
  created_at: string;
  updated_at: string;
  job: {
    id: string;
    company_name: string;
    source: string;
    title: string;
    location: string | null;
    workplace_type: string | null;
    application_url: string;
  };
};

type DashboardFollowUpsResponse = {
  items: DashboardFollowUp[];
};

type ExploreAction = {
  title: string;
  description: string;
  href: string;
};

type TodayState = {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string | null;
  secondaryHref: string | null;
  className: string;
};

const exploreActions: ExploreAction[] = [
  {
    title: "Browse jobs",
    description: "Find your next opportunity.",
    href: "/jobs",
  },
  {
    title: "Applications",
    description: "View every tracked role.",
    href: "/applications",
  },
  {
    title: "Resumes",
    description: "Manage your resume versions.",
    href: "/resumes",
  },
  {
    title: "Sources",
    description: "Manage companies and job boards.",
    href: "/sources",
  },
];

const quickStartSteps = [
  "Add a resume so CareerNeed can evaluate job relevance.",
  "Browse jobs and save roles you want to pursue.",
  "Track applications and set a follow-up date.",
];

function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    value === "saved" ||
    value === "applied" ||
    value === "interviewing" ||
    value === "offer" ||
    value === "rejected" ||
    value === "withdrawn"
  );
}

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

function isDashboardFollowUp(value: unknown): value is DashboardFollowUp {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  const job =
    typeof item.job === "object" && item.job !== null
      ? (item.job as Record<string, unknown>)
      : null;

  return (
    typeof item.id === "string" &&
    typeof item.job_id === "string" &&
    isApplicationStatus(item.status) &&
    typeof item.follow_up_on === "string" &&
    job !== null &&
    typeof job.id === "string" &&
    typeof job.company_name === "string" &&
    typeof job.title === "string"
  );
}

function isDashboardFollowUpsResponse(value: unknown): value is DashboardFollowUpsResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Record<string, unknown>;

  return Array.isArray(response.items) && response.items.every(isDashboardFollowUp);
}

function statusLabel(status: ApplicationStatus): string {
  if (status === "saved") return "Saved";
  if (status === "applied") return "Applied";
  if (status === "interviewing") return "Interviewing";
  if (status === "offer") return "Offer";
  if (status === "rejected") return "Rejected";
  return "Withdrawn";
}

function localDateKey(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function followUpState(value: string): {
  label: string;
  textClassName: string;
  badgeClassName: string;
} {
  const today = localDateKey();

  if (value === today) {
    return {
      label: "Due today",
      textClassName: "text-warning",
      badgeClassName: "border-warning-border bg-warning-background text-warning",
    };
  }

  const startOfToday = new Date(`${today}T00:00:00`);
  const followUpDate = new Date(`${value}T00:00:00`);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const overdueDays = Math.max(
    1,
    Math.round((startOfToday.getTime() - followUpDate.getTime()) / millisecondsPerDay)
  );

  return {
    label: `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`,
    textClassName: "text-destructive",
    badgeClassName: "border-error-border bg-error-background text-destructive",
  };
}

function formatInterviewTime(dateStr: string | null): string {
  if (!dateStr) return "Time not set";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Invalid time";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

function formatFullDate(dateStr: string | null): string {
  if (!dateStr) return "Date TBD";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

function createTodayState(
  summary: DashboardSummary,
  nextFollowUp: DashboardFollowUp | null
): TodayState {
  if (summary.follow_ups_overdue > 0) {
    return {
      eyebrow: "Action needed",
      title: `${summary.follow_ups_overdue} overdue follow-up${
        summary.follow_ups_overdue === 1 ? "" : "s"
      }`,
      description:
        summary.follow_ups_due_today > 0
          ? `${summary.follow_ups_due_today} more follow-up${
              summary.follow_ups_due_today === 1 ? "" : "s"
            } ${summary.follow_ups_due_today === 1 ? "is" : "are"} due today.`
          : "A quick check-in can keep your applications moving.",
      primaryLabel: nextFollowUp ? "Open next follow-up" : "Review overdue follow-ups",
      primaryHref: nextFollowUp
        ? `/applications/${nextFollowUp.id}`
        : "/applications?follow_up=overdue",
      secondaryLabel: "Review all follow-ups",
      secondaryHref: "/applications?follow_up=scheduled",
      className: "border-error-border bg-error-background",
    };
  }

  if (summary.follow_ups_due_today > 0) {
    return {
      eyebrow: "To Do",
      title: `${summary.follow_ups_due_today} follow-up${
        summary.follow_ups_due_today === 1 ? "" : "s"
      } due today`,
      description: "A timely check-in can keep your application moving.",
      primaryLabel: nextFollowUp ? "Open today’s follow-up" : "Review today’s follow-ups",
      primaryHref: nextFollowUp
        ? `/applications/${nextFollowUp.id}`
        : "/applications?follow_up=today",
      secondaryLabel: "View all follow-ups",
      secondaryHref: "/applications?follow_up=scheduled",
      className: "border-warning-border bg-warning-background",
    };
  }

  if (summary.active_applications > 0) {
    return {
      eyebrow: "To Do",
      title: "You’re caught up",
      description: `${summary.active_applications} active application${
        summary.active_applications === 1 ? "" : "s"
      } ${summary.active_applications === 1 ? "is" : "are"} currently in progress.`,
      primaryLabel: "Open pipeline",
      primaryHref: "/applications/board",
      secondaryLabel: "View all applications",
      secondaryHref: "/applications",
      className: "border-primary/30 bg-primary/10",
    };
  }

  return {
    eyebrow: "Get started",
    title: "Start your search",
    description: "Browse roles, save promising opportunities, and track your first application.",
    primaryLabel: "Browse jobs",
    primaryHref: "/jobs",
    secondaryLabel: "Manage resumes",
    secondaryHref: "/resumes",
    className: "border-primary/30 bg-primary/10",
  };
}

export default function TodoClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [followUps, setFollowUps] = useState<DashboardFollowUp[] | null>(null);
  const [upcomingInterviews, setUpcomingInterviews] = useState<UpcomingInterview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const [summaryResponse, followUpsResponse, interviewsResponse] = await Promise.all([
          apiFetch("/dashboard/summary", {
            cache: "no-store",
          }),
          apiFetch("/dashboard/follow-ups?limit=6", {
            cache: "no-store",
          }),
          apiFetch("/interviews/upcoming?days=7", {
            cache: "no-store",
          }),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        if (
          summaryResponse.status === 401 ||
          followUpsResponse.status === 401 ||
          interviewsResponse.status === 401
        ) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!summaryResponse.ok) {
          throw new Error(
            await getApiErrorMessage(summaryResponse, "Unable to load dashboard summary.")
          );
        }

        if (!followUpsResponse.ok) {
          throw new Error(
            await getApiErrorMessage(followUpsResponse, "Unable to load dashboard follow-ups.")
          );
        }

        const summaryData: unknown = await summaryResponse.json();
        const followUpsData: unknown = await followUpsResponse.json();

        if (!isDashboardSummary(summaryData)) {
          throw new Error("The dashboard summary response is invalid.");
        }

        if (!isDashboardFollowUpsResponse(followUpsData)) {
          throw new Error("The dashboard follow-up response is invalid.");
        }

        if (interviewsResponse.ok) {
          const interviewsData = (await interviewsResponse.json()) as UpcomingInterview[];
          setUpcomingInterviews(interviewsData);
        }

        setSummary(summaryData);
        setFollowUps(followUpsData.items);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        if (!controller.signal.aborted) {
          setError(
            caughtError instanceof Error ? caughtError.message : "Unable to load dashboard."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [pathname, router]);

  const dashboardAvailable = summary !== null && followUps !== null;
  const visibleFollowUps = followUps?.slice(0, 3) ?? [];
  const nextFollowUp = visibleFollowUps[0] ?? null;
  const nextFollowUpState = nextFollowUp ? followUpState(nextFollowUp.follow_up_on) : null;
  const todayState = summary ? createTodayState(summary, nextFollowUp) : null;

  const showQuickStart =
    summary !== null &&
    summary.applications_saved === 0 &&
    summary.applications_applied === 0 &&
    summary.applications_interviewing === 0;

  return (
    <main className="bg-background text-foreground min-h-full px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <header className="border-border flex flex-col justify-between gap-5 border-b pb-8 sm:flex-row sm:items-start">
          <div>
            <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              CareerNeed
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Your job-search workspace
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
              Focus on the next action, keep your applications moving, and see your progress at a
              glance.
            </p>
          </div>

          <Link
            href="/jobs/add"
            className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Add a job
          </Link>
        </header>

        {isLoading ? (
          <section className="border-border bg-card mt-8 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">Loading your dashboard…</p>
          </section>
        ) : error ? (
          <section className="border-error-border bg-error-background text-destructive mt-8 rounded-2xl border p-6 sm:p-8">
            <p className="text-sm font-medium">Today</p>
            <h2 className="mt-1 text-2xl font-semibold">We couldn’t refresh your dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6">{error}</p>
            <Link
              href="/applications"
              className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background mt-5 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              View applications <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </section>
        ) : dashboardAvailable && summary && followUps && todayState ? (
          <>
            <section
              className={`mt-8 rounded-2xl border p-6 sm:p-8 ${todayState.className}`}
              aria-labelledby="todo-heading"
            >
              <p className="text-primary text-sm font-semibold tracking-[0.16em] uppercase">
                {todayState.eyebrow}
              </p>
              <h2 id="todo-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
                {todayState.title}
              </h2>
              <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                {todayState.description}
              </p>

              {nextFollowUp && nextFollowUpState ? (
                <Link
                  href={`/applications/${nextFollowUp.id}`}
                  className="border-primary/20 bg-background/50 hover:bg-background/80 focus-visible:ring-primary focus-visible:ring-offset-background mt-5 block max-w-2xl rounded-xl border p-4 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                    Next action
                  </p>
                  <p className="mt-2 text-base font-semibold">
                    Follow up with {nextFollowUp.job.company_name}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {nextFollowUp.job.title} · {statusLabel(nextFollowUp.status)}
                  </p>
                  <span
                    className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${nextFollowUpState.badgeClassName}`}
                  >
                    {nextFollowUpState.label}
                  </span>
                </Link>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={todayState.primaryHref}
                  className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {todayState.primaryLabel}
                  <span aria-hidden="true">&nbsp;→</span>
                </Link>

                {todayState.secondaryLabel && todayState.secondaryHref ? (
                  <Link
                    href={todayState.secondaryHref}
                    className="text-foreground hover:text-primary focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center justify-center px-2 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {todayState.secondaryLabel}
                    <span aria-hidden="true">&nbsp;→</span>
                  </Link>
                ) : null}
              </div>
            </section>

            <section className="mt-10" aria-labelledby="upcoming-interviews-heading">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-primary text-sm font-medium">Schedule</p>
                  <h2 id="upcoming-interviews-heading" className="mt-1 text-2xl font-semibold">
                    Upcoming Interviews
                  </h2>
                </div>

                <Link
                  href="/interviews"
                  className="text-primary focus-visible:ring-primary focus-visible:ring-offset-background shrink-0 text-sm font-semibold transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  View all <span aria-hidden="true">→</span>
                </Link>
              </div>

              {upcomingInterviews.length === 0 ? (
                <article className="border-border bg-card mt-5 rounded-2xl border border-dashed p-6">
                  <h3 className="text-lg font-semibold">No interviews scheduled this week</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    Paste interview invitations in any active application to automatically track
                    your upcoming rounds and preparation here.
                  </p>
                </article>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingInterviews.map((item) => (
                    <div
                      key={item.id}
                      className="border-border bg-card hover:border-primary/50 flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-primary text-xs font-bold tracking-wider uppercase">
                            {item.company_name}
                          </span>
                          <span className="border-border bg-muted text-foreground rounded-md border px-2 py-0.5 text-xs font-semibold">
                            Round {item.round}
                          </span>
                        </div>

                        <h3 className="text-foreground mt-2 text-base font-bold">
                          {item.job_title}
                        </h3>
                        <p className="text-muted-foreground text-sm font-medium">{item.title}</p>

                        <div className="border-border bg-muted/20 mt-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium">
                          <span>⏰</span>
                          <span>{formatInterviewTime(item.scheduled_at)}</span>
                          {item.timezone && <span>({item.timezone})</span>}
                          <span className="text-muted-foreground ml-auto">
                            {formatFullDate(item.scheduled_at)}
                          </span>
                        </div>

                        <div className="mt-3 text-xs">
                          <span className="text-muted-foreground">Preparation: </span>
                          <span
                            className={
                              item.preparation_notes
                                ? "font-medium text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground italic"
                            }
                          >
                            {item.preparation_notes ? "Notes ready" : "Not started"}
                          </span>
                        </div>
                      </div>

                      <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
                        <Link
                          href={`/applications/${item.application_id}`}
                          className="text-primary text-xs font-semibold hover:underline"
                        >
                          Open prep →
                        </Link>

                        {item.meeting_url ? (
                          <a
                            href={item.meeting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-xs transition"
                          >
                            <span>Join</span>
                            <span>↗</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mt-10" aria-labelledby="next-up-heading">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-primary text-sm font-medium">Next up</p>
                  <h2 id="next-up-heading" className="mt-1 text-2xl font-semibold">
                    Needs your attention
                  </h2>
                </div>

                <Link
                  href="/applications?follow_up=scheduled"
                  className="text-primary focus-visible:ring-primary focus-visible:ring-offset-background shrink-0 text-sm font-semibold transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  View all <span aria-hidden="true">→</span>
                </Link>
              </div>

              {visibleFollowUps.length === 0 ? (
                <article className="border-border bg-card mt-5 rounded-2xl border border-dashed p-6">
                  <h3 className="text-lg font-semibold">Nothing to follow up on right now</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    Set a follow-up date from an application whenever you want to plan your next
                    check-in.
                  </p>
                </article>
              ) : (
                <div className="border-border bg-card mt-5 overflow-hidden rounded-2xl border">
                  {visibleFollowUps.map((followUp, index) => {
                    const label = followUpState(followUp.follow_up_on);

                    return (
                      <Link
                        href={`/applications/${followUp.id}`}
                        key={followUp.id}
                        className={`group hover:bg-muted focus-visible:ring-primary flex items-center justify-between gap-4 px-5 py-4 transition focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-6 ${
                          index > 0 ? "border-border border-t" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="group-hover:text-primary truncate text-base font-semibold">
                            {followUp.job.title}
                          </p>
                          <p className="text-muted-foreground mt-1 truncate text-sm">
                            {statusLabel(followUp.status)} · {followUp.job.company_name}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-3">
                          <span className={`text-sm font-semibold ${label.textClassName}`}>
                            {label.label}
                          </span>
                          <span
                            className="text-primary text-lg transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section
              className="border-border bg-card mt-10 rounded-2xl border p-6 sm:p-8"
              aria-labelledby="pipeline-heading"
            >
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="text-primary text-sm font-medium">Your pipeline</p>
                  <h2 id="pipeline-heading" className="mt-1 text-2xl font-semibold">
                    Keep your momentum visible
                  </h2>
                </div>

                <Link
                  href="/applications/board"
                  className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background inline-flex shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  Open pipeline <span aria-hidden="true">&nbsp;→</span>
                </Link>
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="bg-muted rounded-xl p-4">
                  <dt className="text-muted-foreground text-sm">Saved</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">
                    {summary.applications_saved}
                  </dd>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <dt className="text-muted-foreground text-sm">Applied</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">
                    {summary.applications_applied}
                  </dd>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <dt className="text-muted-foreground text-sm">Interviewing</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">
                    {summary.applications_interviewing}
                  </dd>
                </div>
                <div className="bg-muted rounded-xl p-4">
                  <dt className="text-muted-foreground text-sm">Active</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">
                    {summary.active_applications}
                  </dd>
                </div>
              </dl>
            </section>
          </>
        ) : (
          <section className="border-border bg-card mt-8 rounded-2xl border border-dashed p-6 sm:p-8">
            <p className="text-primary text-sm font-medium">Today</p>
            <h2 className="mt-1 text-2xl font-semibold">We couldn’t refresh your dashboard</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              Your saved applications are still available. Try again after the API reconnects.
            </p>
            <Link
              href="/applications"
              className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background mt-5 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              View applications <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </section>
        )}

        <section className="mt-10" aria-labelledby="explore-heading">
          <div>
            <p className="text-primary text-sm font-medium">Explore</p>
            <h2 id="explore-heading" className="mt-1 text-2xl font-semibold">
              Continue your search
            </h2>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {exploreActions.map((action) => (
              <Link
                href={action.href}
                key={action.href}
                className="group border-border bg-card hover:border-primary/50 hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background rounded-xl border p-4 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <h3 className="group-hover:text-primary text-sm font-semibold">{action.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-5">{action.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {showQuickStart ? (
          <section
            className="border-border bg-card mt-10 rounded-2xl border p-6 sm:p-8"
            aria-labelledby="quick-start-heading"
          >
            <p className="text-primary text-sm font-medium">Getting started</p>
            <h2 id="quick-start-heading" className="mt-1 text-2xl font-semibold">
              A simple loop for your search
            </h2>

            <ol className="mt-6 grid gap-5 md:grid-cols-3">
              {quickStartSteps.map((step, index) => (
                <li key={step} className="text-muted-foreground flex gap-3 text-sm leading-6">
                  <span className="bg-muted text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </section>
    </main>
  );
}
