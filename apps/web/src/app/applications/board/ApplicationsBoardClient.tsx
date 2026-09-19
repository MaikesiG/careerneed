"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationViewTabs from "@/components/ApplicationViewTabs";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import PipelineBoard, { type PipelineApplication } from "./PipelineBoard";
import { useRouter } from "next/navigation";
import { getApplicationFollowUpSummaryDisplay } from "@/lib/applicationFollowUpSummary";

export default function ApplicationsBoardClient() {
  const router = useRouter();
  const [applications, setApplications] = useState<PipelineApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      try {
        const response = await apiFetch("/applications?limit=100", {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          setApplications([]);
          router.replace("/login?next=/applications");
          return;
        }

        if (!response.ok) {
          throw new Error(await getApiErrorMessage(response, "Unable to load applications."));
        }

        setApplications((await response.json()) as PipelineApplication[]);
        setError(null);
      } catch (caughtError) {
        if (!cancelled) {
          setApplications([]);
          setError(
            caughtError instanceof Error ? caughtError.message : "Unable to load applications."
          );
        }
      }
    }

    void loadApplications();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const totalApplications = applications?.length ?? 0;
  const activeApplications =
    applications?.filter(
      (application) => application.status === "applied" || application.status === "interviewing"
    ).length ?? 0;

  const attentionCount =
    applications?.filter(
      (application) =>
        getApplicationFollowUpSummaryDisplay(
          application.next_open_follow_up_at,
          application.open_follow_up_count
        )?.needsAttention ?? false
    ).length ?? 0;

  return (
    <PageContainer size="default">
      <PageHeader
        title="Applications"
        description="See every opportunity by stage, identify stalled applications, and decide your next move."
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ApplicationViewTabs currentView="pipeline" />
            <Link
              href="/jobs"
              className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary focus-visible:ring-offset-background inline-flex h-9 sm:h-10 items-center justify-center rounded-lg border px-3.5 text-xs sm:text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Browse jobs
            </Link>
          </div>
        }
      />

        {error ? (
          <section className="border-error-border bg-error-background text-destructive mt-6 rounded-2xl border p-6">
            <h2 className="text-base sm:text-lg font-semibold">Pipeline is temporarily unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6">{error}</p>
            <Link
              href="/applications"
              className="text-primary mt-4 inline-flex text-sm font-semibold transition hover:opacity-80"
            >
              View applications <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </section>
        ) : applications === null ? (
          <section className="border-border bg-card mt-6 rounded-2xl border border-dashed p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">Loading your pipeline…</p>
          </section>
        ) : (
          <>
            <section
              className="border-border bg-card rounded-2xl border p-5 sm:p-6"
              aria-label="Pipeline summary"
            >
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-xs sm:text-sm">Tracked jobs</dt>
                  <dd className="mt-1 text-xl sm:text-2xl font-bold tracking-tight">{totalApplications}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs sm:text-sm">Active applications</dt>
                  <dd className="mt-1 text-xl sm:text-2xl font-bold tracking-tight">{activeApplications}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs sm:text-sm">Need attention</dt>
                  <dd
                    className={`mt-1 text-xl sm:text-2xl font-bold tracking-tight ${
                      attentionCount > 0 ? "text-destructive" : ""
                    }`}
                  >
                    {attentionCount}
                  </dd>
                </div>
              </dl>

              {attentionCount > 0 ? (
                <Link
                  href="/applications?follow_up=scheduled"
                  className="text-primary mt-4 inline-flex text-xs sm:text-sm font-semibold transition hover:opacity-80"
                >
                  Review follow-ups <span aria-hidden="true">&nbsp;→</span>
                </Link>
              ) : null}
            </section>

            <PipelineBoard applications={applications} />
          </>
        )}
    </PageContainer>
  );
}
