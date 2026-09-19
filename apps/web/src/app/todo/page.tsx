"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  apiFetch,
  getApiErrorMessage,
  TodayPrioritiesResponse,
  TodayPriorityActionKind,
  TodayPriorityGroupKey,
} from "@/lib/api";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";

type DashboardSummary = {
  follow_ups_due_today: number;
  follow_ups_overdue: number;
  applications_saved: number;
  applications_applied: number;
  applications_interviewing: number;
  active_applications: number;
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
  "Add a resume so the system can evaluate job relevance.",
  "Browse jobs and save roles you want to pursue.",
  "Track applications and set a follow-up date.",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTodayGroupKey(value: unknown): value is TodayPriorityGroupKey {
  return (
    value === "overdue_follow_ups" ||
    value === "interviews_today" ||
    value === "follow_ups_due_today" ||
    value === "upcoming_interviews" ||
    value === "applications_needing_update"
  );
}

function isTodayActionKind(value: unknown): value is TodayPriorityActionKind {
  return value === "follow_up" || value === "interview" || value === "application_update";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isTodayPriorityItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isTodayActionKind(value.action_kind) &&
    typeof value.title === "string" &&
    typeof value.application_id === "string" &&
    typeof value.company_name === "string" &&
    typeof value.job_title === "string" &&
    isNullableString(value.interview_id) &&
    isNullableString(value.occurs_at) &&
    isNullableString(value.timezone) &&
    isNullableString(value.status)
  );
}

function isTodayPrioritiesResponse(value: unknown): value is TodayPrioritiesResponse {
  if (
    !isRecord(value) ||
    typeof value.timezone !== "string" ||
    typeof value.local_date !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(value.groups)) return false;
  return value.groups.every(
    (group) =>
      isRecord(group) &&
      isTodayGroupKey(group.key) &&
      typeof group.priority === "number" &&
      Array.isArray(group.items) &&
      group.items.every(isTodayPriorityItem)
  );
}

function browserTimezone(): string {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof timezone === "string" && timezone.trim() && validIanaTimezone(timezone)
    ? timezone
    : "UTC";
}

function validIanaTimezone(value: string | null): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function formatPriorityTimestamp(value: string | null, timezone: string | null): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(validIanaTimezone(timezone) ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return "Time unavailable";
  }
}

function formatInterviewTime(value: string | null, timezone: string | null): string {
  if (!value) return "Time not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid time";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(validIanaTimezone(timezone) ? { timeZone: timezone } : {}),
    }).format(date);
  } catch {
    return "Time not set";
  }
}

function displayPriorityStatus(value: string | null): string {
  if (!value) return "Status unavailable";
  return value.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
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

function createCaughtUpState(summary: DashboardSummary): TodayState {
  if (summary.active_applications > 0) {
    return {
      eyebrow: "Pipeline",
      title: "You’re caught up",
      description: `${summary.active_applications} active application${
        summary.active_applications === 1 ? "" : "s"
      } currently in progress.`,
      primaryLabel: "Open pipeline",
      primaryHref: "/applications/board",
      secondaryLabel: "View all applications",
      secondaryHref: "/applications",
      className: "border-primary/25 bg-primary/5",
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
    className: "border-primary/25 bg-primary/5",
  };
}

export default function TodoClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const [todayPriorities, setTodayPriorities] = useState<TodayPrioritiesResponse | null>(null);
  const [isTodayLoading, setIsTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const todayInFlightRef = useRef(false);
  const todayMountedRef = useRef(false);
  const todayAbortRef = useRef<AbortController | null>(null);

  const loadTodayPriorities = useCallback(async () => {
    if (todayInFlightRef.current) return;
    todayInFlightRef.current = true;
    const controller = new AbortController();
    todayAbortRef.current = controller;
    if (todayMountedRef.current) {
      setIsTodayLoading(true);
      setTodayError(null);
    }
    try {
      const timezone = browserTimezone();
      const response = await apiFetch(`/dashboard/today?timezone=${encodeURIComponent(timezone)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (controller.signal.aborted || !todayMountedRef.current) return;
      if (response.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) throw new Error("request failed");
      const payload: unknown = await response.json();
      if (!isTodayPrioritiesResponse(payload)) throw new Error("invalid response");
      if (!controller.signal.aborted && todayMountedRef.current) {
        setTodayPriorities(payload);
      }
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      if (!controller.signal.aborted && todayMountedRef.current) {
        setTodayError("Unable to load today’s priorities. Please try again.");
      }
    } finally {
      if (todayAbortRef.current === controller) {
        todayInFlightRef.current = false;
        if (!controller.signal.aborted && todayMountedRef.current) setIsTodayLoading(false);
      }
    }
  }, [pathname, router]);

  useEffect(() => {
    todayMountedRef.current = true;
    // Initial client-only request requires the browser's resolved IANA timezone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTodayPriorities();
    return () => {
      todayMountedRef.current = false;
      todayAbortRef.current?.abort();
      todayInFlightRef.current = false;
    };
  }, [loadTodayPriorities]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSummary() {
      try {
        const summaryResponse = await apiFetch("/dashboard/summary", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (summaryResponse.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        if (!summaryResponse.ok) {
          throw new Error(
            await getApiErrorMessage(summaryResponse, "Unable to load dashboard summary.")
          );
        }

        const summaryData: unknown = await summaryResponse.json();

        if (!isDashboardSummary(summaryData)) {
          throw new Error("The dashboard summary response is invalid.");
        }

        setSummary(summaryData);
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }
      }
    }

    void loadSummary();

    return () => {
      controller.abort();
    };
  }, [pathname, router]);

  const overdueGroup = todayPriorities?.groups.find((g) => g.key === "overdue_follow_ups");
  const interviewsTodayGroup = todayPriorities?.groups.find((g) => g.key === "interviews_today");
  const followUpsDueTodayGroup = todayPriorities?.groups.find(
    (g) => g.key === "follow_ups_due_today"
  );
  const upcomingInterviewsGroup = todayPriorities?.groups.find(
    (g) => g.key === "upcoming_interviews"
  );
  const applicationsNeedingUpdateGroup = todayPriorities?.groups.find(
    (g) => g.key === "applications_needing_update"
  );

  const overdueItems = overdueGroup?.items ?? [];
  const followUpsDueTodayItems = followUpsDueTodayGroup?.items ?? [];
  const interviewsTodayItems = interviewsTodayGroup?.items ?? [];
  const upcomingInterviewItems = upcomingInterviewsGroup?.items ?? [];
  const applicationsNeedingUpdateItems = applicationsNeedingUpdateGroup?.items ?? [];

  const urgentActionCount = overdueItems.length + followUpsDueTodayItems.length;

  const showQuickStart =
    summary !== null &&
    summary.applications_saved === 0 &&
    summary.applications_applied === 0 &&
    summary.applications_interviewing === 0;

  const caughtUpState = summary ? createCaughtUpState(summary) : null;

  return (
    <PageContainer size="default">
      <PageHeader
        title="Today"
        description="Focus on the next action, keep your applications moving, and see your progress at a glance."
        badge={
          urgentActionCount > 0 ? (
            <span className="border-warning-border bg-warning-background text-warning inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
              {urgentActionCount} {urgentActionCount === 1 ? "action needs" : "actions need"}{" "}
              attention
            </span>
          ) : null
        }
        actions={
          <Link
            href="/jobs/add"
            className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex shrink-0 items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Add a job
          </Link>
        }
      />

        {/* Priorities Section (Action-First) */}
        {isTodayLoading ? (
          <section className="border-border bg-card mt-6 rounded-xl border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">Loading today’s priorities…</p>
          </section>
        ) : todayError ? (
          <section className="border-error-border bg-error-background text-destructive mt-6 rounded-xl border p-5">
            <p className="text-sm font-medium">{todayError}</p>
            <button
              type="button"
              onClick={() => void loadTodayPriorities()}
              className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background mt-4 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Retry
            </button>
          </section>
        ) : todayPriorities ? (
          <>
            {/* Primary action area at the top: Needs attention queue */}
            <section className="mt-6 space-y-3" aria-labelledby="needs-attention-heading">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2
                    id="needs-attention-heading"
                    className="text-foreground text-base font-semibold sm:text-lg"
                  >
                    Needs attention
                  </h2>
                  {urgentActionCount > 0 ? (
                    <span className="border-warning-border bg-warning-background text-warning rounded-full border px-2 py-0.5 text-xs font-semibold">
                      {urgentActionCount}
                    </span>
                  ) : null}
                </div>
              </div>

              {urgentActionCount === 0 ? (
                <div className="border-border bg-muted/20 text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs sm:text-sm">
                  <span className="text-success text-sm font-bold" aria-hidden="true">
                    ✓
                  </span>
                  <span>No urgent actions today.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Overdue follow-ups first */}
                  {overdueItems.map((item) => {
                    const showTimezone = validIanaTimezone(item.timezone);
                    return (
                      <Link
                        key={`overdue-${item.id}`}
                        href={`/applications/${item.application_id}`}
                        className="border-border hover:border-destructive/60 hover:bg-muted/30 focus-visible:ring-primary focus-visible:ring-offset-background group border-l-destructive bg-card flex flex-col justify-between gap-2.5 rounded-xl border border-l-4 p-3 transition focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3"
                      >
                        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                          <span className="border-error-border bg-error-background text-destructive shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">
                            Overdue
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="group-hover:text-primary text-foreground truncate text-sm font-semibold transition-colors">
                                {item.title}
                              </h3>
                              {item.status ? (
                                <span className="border-border bg-muted/40 text-muted-foreground shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium">
                                  {displayPriorityStatus(item.status)}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {item.company_name} · {item.job_title}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-3 text-xs sm:justify-end">
                          <span className="text-destructive font-medium">
                            {formatPriorityTimestamp(item.occurs_at, item.timezone)}
                            {showTimezone ? ` · ${item.timezone}` : ""}
                          </span>
                          <span
                            className="text-primary font-semibold transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          >
                            View application →
                          </span>
                        </div>
                      </Link>
                    );
                  })}

                  {/* Due-today follow-ups directly after */}
                  {followUpsDueTodayItems.map((item) => {
                    const showTimezone = validIanaTimezone(item.timezone);
                    return (
                      <Link
                        key={`due-today-${item.id}`}
                        href={`/applications/${item.application_id}`}
                        className="border-border hover:border-warning/60 hover:bg-muted/30 focus-visible:ring-primary focus-visible:ring-offset-background group border-l-warning bg-card flex flex-col justify-between gap-2.5 rounded-xl border border-l-4 p-3 transition focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3"
                      >
                        <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
                          <span className="border-warning-border bg-warning-background text-warning shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold">
                            Due today
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="group-hover:text-primary text-foreground truncate text-sm font-semibold transition-colors">
                                {item.title}
                              </h3>
                              {item.status ? (
                                <span className="border-border bg-muted/40 text-muted-foreground shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium">
                                  {displayPriorityStatus(item.status)}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {item.company_name} · {item.job_title}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-3 text-xs sm:justify-end">
                          <span className="text-warning font-medium">
                            {formatPriorityTimestamp(item.occurs_at, item.timezone)}
                            {showTimezone ? ` · ${item.timezone}` : ""}
                          </span>
                          <span
                            className="text-primary font-semibold transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          >
                            View application →
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* You’re caught up section (moderately shrunk, shown when no urgent actions) */}
            {caughtUpState && urgentActionCount === 0 ? (
              <section
                className={`mt-4 rounded-xl border p-3.5 sm:p-4 ${caughtUpState.className}`}
                aria-labelledby="todo-heading"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-primary text-xs font-semibold tracking-wider uppercase">
                        {caughtUpState.eyebrow}
                      </span>
                      <span className="text-muted-foreground text-xs" aria-hidden="true">
                        •
                      </span>
                      <h2
                        id="todo-heading"
                        className="text-foreground text-sm font-semibold sm:text-base"
                      >
                        {caughtUpState.title}
                      </h2>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">
                      {caughtUpState.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      href={caughtUpState.primaryHref}
                      className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      {caughtUpState.primaryLabel}
                      <span aria-hidden="true">&nbsp;→</span>
                    </Link>

                    {caughtUpState.secondaryLabel && caughtUpState.secondaryHref ? (
                      <Link
                        href={caughtUpState.secondaryHref}
                        className="text-foreground hover:text-primary focus-visible:ring-primary focus-visible:ring-offset-background inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {caughtUpState.secondaryLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            {/* Today schedule area: interviews_today */}
            <section className="mt-8 space-y-3" aria-labelledby="today-schedule-heading">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2
                    id="today-schedule-heading"
                    className="text-foreground text-base font-semibold sm:text-lg"
                  >
                    Today’s schedule
                  </h2>
                  {interviewsTodayItems.length > 0 ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                      {interviewsTodayItems.length}
                    </span>
                  ) : null}
                </div>
              </div>

              {interviewsTodayItems.length === 0 ? (
                <div className="border-border bg-muted/10 text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-xs sm:text-sm">
                  No interviews scheduled today.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {interviewsTodayItems.map((item) => {
                    const showTimezone = validIanaTimezone(item.timezone);
                    return (
                      <Link
                        key={`interview-today-${item.id}`}
                        href={`/applications/${item.application_id}`}
                        className="border-border bg-card hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-primary focus-visible:ring-offset-background group flex flex-col justify-between gap-2.5 rounded-xl border p-3 transition focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3"
                      >
                        <div className="flex min-w-0 items-start gap-3 sm:items-center">
                          <div className="border-border bg-muted/60 text-foreground flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold">
                            <span aria-hidden="true">⏰</span>
                            <span>{formatInterviewTime(item.occurs_at, item.timezone)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="group-hover:text-primary text-foreground truncate text-sm font-semibold transition-colors">
                                {item.title}
                              </h3>
                              {item.status ? (
                                <span className="border-border bg-muted/50 text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium">
                                  {displayPriorityStatus(item.status)}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {item.company_name} · {item.job_title}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-3 text-xs sm:justify-end">
                          <span className="text-muted-foreground">
                            {showTimezone ? item.timezone : ""}
                          </span>
                          <span
                            className="text-primary font-semibold transition-transform group-hover:translate-x-0.5"
                            aria-hidden="true"
                          >
                            View application →
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Secondary lower-priority area: upcoming_interviews and applications_needing_update */}
            <section className="mt-8 space-y-4" aria-labelledby="secondary-priorities-heading">
              <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                {/* Column 1: Upcoming interviews */}
                <div className="space-y-3" aria-labelledby="upcoming-interviews-heading">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="upcoming-interviews-heading"
                      className="text-foreground text-sm font-semibold"
                    >
                      Upcoming interviews
                    </h3>
                    {upcomingInterviewItems.length > 0 ? (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                        {upcomingInterviewItems.length}
                      </span>
                    ) : null}
                  </div>

                  {upcomingInterviewItems.length === 0 ? (
                    <div className="border-border bg-muted/10 text-muted-foreground rounded-xl border border-dashed px-3.5 py-2.5 text-xs">
                      No upcoming interviews.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingInterviewItems.map((item) => (
                        <Link
                          key={`upcoming-${item.id}`}
                          href={`/applications/${item.application_id}`}
                          className="border-border bg-card hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-primary focus-visible:ring-offset-background group block rounded-xl border p-3 transition focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="group-hover:text-primary text-foreground truncate text-xs font-semibold transition-colors sm:text-sm">
                              {item.title}
                            </h4>
                            {item.status ? (
                              <span className="border-border bg-muted/50 text-muted-foreground shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium">
                                {displayPriorityStatus(item.status)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {item.company_name} · {item.job_title}
                          </p>
                          <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                            <span>{formatPriorityTimestamp(item.occurs_at, item.timezone)}</span>
                            <span
                              className="text-primary font-medium transition-transform group-hover:translate-x-0.5"
                              aria-hidden="true"
                            >
                              View →
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Column 2: Applications needing update */}
                <div className="space-y-3" aria-labelledby="applications-needing-update-heading">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      id="applications-needing-update-heading"
                      className="text-foreground text-sm font-semibold"
                    >
                      Applications needing update
                    </h3>
                    {applicationsNeedingUpdateItems.length > 0 ? (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                        {applicationsNeedingUpdateItems.length}
                      </span>
                    ) : null}
                  </div>

                  {applicationsNeedingUpdateItems.length === 0 ? (
                    <div className="border-border bg-muted/10 text-muted-foreground rounded-xl border border-dashed px-3.5 py-2.5 text-xs">
                      No applications needing update.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {applicationsNeedingUpdateItems.map((item) => (
                        <Link
                          key={`update-${item.id}`}
                          href={`/applications/${item.application_id}`}
                          className="border-border bg-card hover:border-primary/50 hover:bg-muted/30 focus-visible:ring-primary focus-visible:ring-offset-background group block rounded-xl border p-3 transition focus-visible:ring-2 focus-visible:outline-none"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="group-hover:text-primary text-foreground truncate text-xs font-semibold transition-colors sm:text-sm">
                              {item.title}
                            </h4>
                            {item.status ? (
                              <span className="border-border bg-muted/50 text-muted-foreground shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-medium">
                                {displayPriorityStatus(item.status)}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-0.5 truncate text-xs">
                            {item.company_name} · {item.job_title}
                          </p>
                          <div className="mt-2 flex items-center justify-end text-xs">
                            <span
                              className="text-primary font-medium transition-transform group-hover:translate-x-0.5"
                              aria-hidden="true"
                            >
                              View →
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {/* Lower priority sections: Pipeline stats */}
        {summary ? (
          <section
            className="border-border bg-card mt-8 rounded-xl border p-4 sm:p-5"
            aria-labelledby="pipeline-heading"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-primary text-xs font-semibold tracking-wider uppercase">
                  Your pipeline
                </p>
                <h2 id="pipeline-heading" className="text-base font-semibold sm:text-lg">
                  Keep your momentum visible
                </h2>
              </div>

              <Link
                href="/applications/board"
                className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background inline-flex shrink-0 items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Open pipeline <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="bg-muted rounded-lg p-3">
                <dt className="text-muted-foreground text-xs">Saved</dt>
                <dd className="mt-0.5 text-xl font-bold tracking-tight">
                  {summary.applications_saved}
                </dd>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <dt className="text-muted-foreground text-xs">Applied</dt>
                <dd className="mt-0.5 text-xl font-bold tracking-tight">
                  {summary.applications_applied}
                </dd>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <dt className="text-muted-foreground text-xs">Interviewing</dt>
                <dd className="mt-0.5 text-xl font-bold tracking-tight">
                  {summary.applications_interviewing}
                </dd>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <dt className="text-muted-foreground text-xs">Active</dt>
                <dd className="mt-0.5 text-xl font-bold tracking-tight">
                  {summary.active_applications}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}

        {/* Explore section */}
        <section className="mt-6 space-y-3" aria-labelledby="explore-heading">
          <div>
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">Explore</p>
            <h2 id="explore-heading" className="text-base font-semibold">
              Continue your search
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {exploreActions.map((action) => (
              <Link
                href={action.href}
                key={action.href}
                className="group border-border bg-card hover:border-primary/50 hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background rounded-xl border p-3.5 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <h3 className="group-hover:text-primary text-xs font-semibold sm:text-sm">
                  {action.title}
                </h3>
                <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                  {action.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* Quick start steps (only if no applications) */}
        {showQuickStart ? (
          <section
            className="border-border bg-card mt-6 rounded-xl border p-4 sm:p-5"
            aria-labelledby="quick-start-heading"
          >
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">
              Getting started
            </p>
            <h2 id="quick-start-heading" className="text-base font-semibold">
              A simple loop for your search
            </h2>

            <ol className="mt-4 grid gap-4 md:grid-cols-3">
              {quickStartSteps.map((step, index) => (
                <li key={step} className="text-muted-foreground flex gap-2.5 text-xs leading-5">
                  <span className="bg-muted text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
    </PageContainer>
  );
}
