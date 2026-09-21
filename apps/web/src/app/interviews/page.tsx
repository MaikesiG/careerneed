"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch, getApiErrorMessage, UpcomingInterview } from "@/lib/api";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";

type GroupKey = "today" | "tomorrow" | "this_week" | "later" | "past";

function getGroupKey(dateStr: string | null): GroupKey {
  if (!dateStr) return "later";
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfDayAfterTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()));

  if (date < startOfToday) {
    return "past";
  }
  if (date >= startOfToday && date < startOfTomorrow) {
    return "today";
  }
  if (date >= startOfTomorrow && date < startOfDayAfterTomorrow) {
    return "tomorrow";
  }
  if (date >= startOfDayAfterTomorrow && date <= endOfWeek) {
    return "this_week";
  }
  return "later";
}

function formatInterviewTime(dateStr: string | null): string {
  if (!dateStr) return "Time not specified";
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
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<UpcomingInterview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upcoming" | "all">("upcoming");

  useEffect(() => {
    async function fetchInterviews() {
      setIsLoading(true);
      setError(null);
      try {
        const query =
          activeTab === "all" ? "?days=180&include_past=true" : "?days=60&include_past=false";
        const res = await apiFetch(`/interviews/upcoming${query}`);
        if (!res.ok) {
          throw new Error(await getApiErrorMessage(res, "Failed to load upcoming interviews"));
        }
        const data = (await res.json()) as UpcomingInterview[];
        setInterviews(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interviews");
      } finally {
        setIsLoading(false);
      }
    }
    fetchInterviews();
  }, [activeTab]);

  const groups: Record<GroupKey, UpcomingInterview[]> = {
    today: [],
    tomorrow: [],
    this_week: [],
    later: [],
    past: [],
  };

  interviews.forEach((item) => {
    const key = getGroupKey(item.scheduled_at);
    groups[key].push(item);
  });

  const groupConfigs: { key: GroupKey; label: string; badgeClass: string; icon: string }[] = [
    {
      key: "today",
      label: "Today",
      badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
      icon: "🎯",
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      icon: "⚡",
    },
    {
      key: "this_week",
      label: "This Week",
      badgeClass: "bg-primary/10 text-primary border-primary/30",
      icon: "🗓️",
    },
    {
      key: "later",
      label: "Later",
      badgeClass: "bg-muted text-muted-foreground border-border",
      icon: "📌",
    },
    {
      key: "past",
      label: "Past / Needs Review",
      badgeClass: "bg-muted text-muted-foreground border-border",
      icon: "⏳",
    },
  ];

  return (
    <PageContainer size="default">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">
              💼
            </span>
            <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
              Interview Center
            </h1>
          </div>
        }
        description="Consolidated upcoming rounds, meeting links, and preparation context across all active applications."
        actions={
          <div className="border-border bg-card inline-flex rounded-lg border p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("upcoming")}
              className={`rounded-md px-3 py-1.5 font-semibold transition ${
                activeTab === "upcoming"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Upcoming (Next 60d)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-md px-3 py-1.5 font-semibold transition ${
                activeTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All & Past
            </button>
          </div>
        }
      />

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-6 rounded-xl border p-4 text-sm">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-muted-foreground py-20 text-center text-sm">
          Loading interview schedule…
        </div>
      ) : interviews.length === 0 ? (
        <div className="border-border bg-card mt-8 rounded-2xl border p-12 text-center shadow-sm">
          <span className="text-4xl">🗓️</span>
          <h2 className="mt-3 text-lg font-semibold">No interviews found</h2>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            When recruiters schedule rounds with you, you can paste the email invitation into any
            tracked Application to auto-schedule it here.
          </p>
          <div className="mt-6">
            <Link
              href="/applications"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-xs transition"
            >
              Go to Applications →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groupConfigs.map(({ key, label, badgeClass, icon }) => {
            const list = groups[key];
            if (list.length === 0) return null;

            return (
              <section key={key}>
                <div className="border-border flex items-center gap-2 border-b pb-2.5">
                  <span className="text-lg">{icon}</span>
                  <h2 className="text-lg font-bold">{label}</h2>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
                  >
                    {list.length}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {list.map((item) => {
                    const isPast = item.scheduled_at && new Date(item.scheduled_at) < new Date();
                    const isOverdue = isPast && item.status === "scheduled";

                    return (
                      <div
                        key={item.id}
                        className="border-border bg-card hover:border-primary/50 flex flex-col justify-between rounded-xl border p-4 shadow-xs transition"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-primary text-xs font-bold tracking-wider uppercase">
                                {item.company_name}
                              </span>
                              <h3 className="text-foreground text-base font-bold">
                                {item.job_title}
                              </h3>
                            </div>

                            <span className="border-border bg-muted text-foreground shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold">
                              Round {item.round}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center gap-2 text-sm font-semibold">
                            <span className="text-foreground">{item.title}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground text-xs tracking-wide uppercase">
                              {item.interview_type}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <div className="border-border bg-muted/30 text-foreground flex items-center gap-1 rounded-md border px-2 py-1 font-medium">
                              <span>⏰</span>
                              <span>{formatInterviewTime(item.scheduled_at)}</span>
                              {item.timezone && <span>({item.timezone})</span>}
                            </div>

                            <div className="border-border bg-muted/30 text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1">
                              <span>📅</span>
                              <span>{formatFullDate(item.scheduled_at)}</span>
                            </div>

                            <div className="border-border bg-muted/30 text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1">
                              <span>⏱️ {item.duration_minutes ?? 60}m</span>
                            </div>
                          </div>

                          {item.interviewer_name && (
                            <div className="text-muted-foreground mt-2.5 text-xs">
                              <span>Interviewer: </span>
                              <strong className="text-foreground">{item.interviewer_name}</strong>
                              {item.interviewer_title && <span> ({item.interviewer_title})</span>}
                            </div>
                          )}

                          {item.preparation_notes ? (
                            <div className="bg-muted/30 border-border/60 mt-3 rounded-lg border p-2.5 text-xs">
                              <p className="text-foreground font-semibold">Prep note:</p>
                              <p className="text-muted-foreground mt-0.5 line-clamp-2">
                                {item.preparation_notes}
                              </p>
                            </div>
                          ) : (
                            <div className="text-muted-foreground mt-2 text-xs italic">
                              Preparation: Not started
                            </div>
                          )}
                        </div>

                        <div className="border-border mt-4 flex items-center justify-between border-t pt-3">
                          <Link
                            href={`/applications/${item.application_id}`}
                            className="text-primary text-xs font-semibold hover:underline"
                          >
                            View Application →
                          </Link>

                          {item.meeting_url ? (
                            <a
                              href={item.meeting_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition"
                            >
                              <span>Join Meeting</span>
                              <span>↗</span>
                            </a>
                          ) : isOverdue ? (
                            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              Needs update
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
