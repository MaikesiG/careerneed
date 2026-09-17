"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ApplicationViewTabs from "@/components/ApplicationViewTabs";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import PipelineBoard, { type PipelineApplication } from "./PipelineBoard";
import { useRouter } from "next/navigation";

function localDateKey(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

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

  const today = localDateKey();
  const attentionCount =
    applications?.filter(
      (application) => application.follow_up_on !== null && application.follow_up_on <= today
    ).length ?? 0;

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              CareerNeed
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Application pipeline
            </h1>
            <p className="text-muted-foreground mt-3 max-w-2xl">
              See every opportunity by stage, identify stalled applications, and decide your next
              move.
            </p>
          </div>
          <ApplicationViewTabs currentView="pipeline" />
        </header>

        {error ? (
          <section className="border-error-border bg-error-background text-destructive mt-8 rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Pipeline is temporarily unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6">{error}</p>
            <Link
              href="/applications"
              className="text-primary mt-4 inline-flex text-sm font-semibold transition hover:opacity-80"
            >
              View applications <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </section>
        ) : applications === null ? (
          <section className="border-border bg-card mt-8 rounded-2xl border border-dashed p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">Loading your pipeline…</p>
          </section>
        ) : (
          <>
            <section
              className="border-border bg-card mt-8 rounded-2xl border p-5 sm:p-6"
              aria-label="Pipeline summary"
            >
              <dl className="grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground text-sm">Tracked jobs</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">{totalApplications}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Active applications</dt>
                  <dd className="mt-1 text-2xl font-bold tracking-tight">{activeApplications}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Need attention</dt>
                  <dd
                    className={`mt-1 text-2xl font-bold tracking-tight ${
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
                  className="text-primary mt-4 inline-flex text-sm font-semibold transition hover:opacity-80"
                >
                  Review follow-ups <span aria-hidden="true">&nbsp;→</span>
                </Link>
              ) : null}
            </section>

            <PipelineBoard applications={applications} />
          </>
        )}
      </div>
    </main>
  );
}
