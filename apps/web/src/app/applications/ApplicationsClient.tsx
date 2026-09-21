"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ApplicationViewTabs from "@/components/ApplicationViewTabs";
import { apiFetch, type ApplicationListItem, getApiErrorMessage } from "@/lib/api";
import { getApplicationFollowUpSummaryDisplay } from "@/lib/applicationFollowUpSummary";
import {
  buildApplicationsHref,
  buildApplicationsRequestPath,
  type ApplicationFollowUpFilter,
} from "@/lib/applicationListSearchParams";
import { browserTimezone } from "@/lib/followUpTime";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";

type ApplicationStatus = ApplicationListItem["status"];
type FollowUpFilter = ApplicationFollowUpFilter;

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const FOLLOW_UP_OPTIONS: { value: FollowUpFilter; label: string }[] = [
  { value: "all", label: "All follow-ups" },
  { value: "today", label: "Due today" },
  { value: "overdue", label: "Overdue" },
  { value: "scheduled", label: "Scheduled" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatStatus(status: ApplicationStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function statusClass(status: ApplicationStatus): string {
  if (status === "applied") {
    return "border-success-border bg-success-background text-success";
  }

  if (status === "interviewing" || status === "saved") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  if (status === "offer") {
    return "border-warning-border bg-warning-background text-warning";
  }

  return "border-border bg-muted text-muted-foreground";
}

function isApplicationStatus(value: string | null): value is ApplicationStatus {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

function isFollowUpFilter(value: string | null): value is FollowUpFilter {
  return FOLLOW_UP_OPTIONS.some((option) => option.value === value);
}

export default function ApplicationsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const requestedFollowUp = searchParams.get("follow_up");

  const selectedStatus: ApplicationStatus | null = isApplicationStatus(requestedStatus)
    ? requestedStatus
    : null;
  const selectedFollowUp: FollowUpFilter = isFollowUpFilter(requestedFollowUp)
    ? requestedFollowUp
    : "all";

  const requestPath = useMemo(() => {
    return buildApplicationsRequestPath(selectedStatus, selectedFollowUp, browserTimezone());
  }, [selectedFollowUp, selectedStatus]);

  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      try {
        const response = await apiFetch(requestPath, {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.push("/login?next=/applications");
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Unable to load applications."));
        }

        setApplications((await response.json()) as ApplicationListItem[]);
        setError(null);
      } catch (caughtError) {
        if (!cancelled) {
          setApplications([]);
          setError(
            caughtError instanceof Error ? caughtError.message : "Unable to load applications."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadApplications();

    return () => {
      cancelled = true;
    };
  }, [requestPath, router]);

  return (
    <PageContainer size="default">
      <PageHeader
        title="Applications"
        description="Track every role you saved or applied to. Results are ordered by most recently updated."
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ApplicationViewTabs currentView="list" />
            <Link
              href="/jobs"
              className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-9 items-center justify-center rounded-lg border px-3.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:h-10 sm:text-sm"
            >
              Browse jobs
            </Link>
          </div>
        }
      />

      <nav
        aria-label="Application status filters"
        className="mb-2.5 flex flex-wrap gap-1.5 sm:gap-2"
      >
        <Link
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
            selectedStatus === null
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:bg-muted"
          }`}
          href={buildApplicationsHref(null, selectedFollowUp)}
        >
          All statuses
        </Link>
        {STATUS_OPTIONS.map((option) => (
          <Link
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
              selectedStatus === option.value
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
            href={buildApplicationsHref(option.value, selectedFollowUp)}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <nav aria-label="Follow-up filters" className="mb-5 flex flex-wrap gap-1.5 sm:gap-2">
        {FOLLOW_UP_OPTIONS.map((option) => (
          <Link
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
              selectedFollowUp === option.value
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
            href={buildApplicationsHref(selectedStatus, option.value)}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <section className="border-error-border bg-error-background text-destructive rounded-2xl border p-6">
          <h2 className="text-lg font-semibold">Applications are temporarily unavailable</h2>
          <p className="mt-2 text-sm">{error}</p>
        </section>
      ) : isLoading ? (
        <section className="border-border bg-card rounded-2xl border border-dashed p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">Loading your applications…</p>
        </section>
      ) : (
        <>
          <p className="text-muted-foreground mb-4 text-sm">{applications.length} tracked jobs</p>

          {applications.length === 0 ? (
            <section className="border-border bg-card rounded-2xl border border-dashed p-8 text-center shadow-sm">
              <h2 className="text-lg font-semibold">No tracked jobs here yet</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Choose a tracking status from any job card to start your workflow.
              </p>
            </section>
          ) : (
            <section className="grid gap-4">
              {applications.map((application) => {
                const followUp = getApplicationFollowUpSummaryDisplay(
                  application.next_open_follow_up_at,
                  application.open_follow_up_count
                );

                return (
                  <article
                    className="border-border bg-card rounded-2xl border p-5 shadow-sm"
                    key={application.id}
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold sm:text-lg">
                            {application.job.title}
                          </h2>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                              application.status
                            )}`}
                          >
                            {formatStatus(application.status)}
                          </span>
                          {followUp ? (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${followUp.className}`}
                            >
                              {followUp.label}
                              {followUp.countLabel ? ` · ${followUp.countLabel}` : ""}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-foreground mt-2 text-sm font-medium">
                          {application.job.company_name}
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {application.job.location ?? "Location not specified"}
                        </p>
                        {application.notes ? (
                          <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
                            {application.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex h-fit shrink-0 flex-wrap gap-2">
                        <Link
                          className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition"
                          href={`/applications/${application.id}`}
                        >
                          View details
                        </Link>
                        <a
                          className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition"
                          href={application.job.application_url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          View posting
                        </a>
                      </div>
                    </div>
                    <footer className="border-border text-muted-foreground mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t pt-4 text-sm">
                      {application.applied_at ? (
                        <span>Applied {formatDate(application.applied_at)}</span>
                      ) : null}
                      <span>Updated {formatDate(application.updated_at)}</span>
                      <span>{application.resume_id ? "Resume linked" : "No resume linked"}</span>
                    </footer>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </PageContainer>
  );
}
