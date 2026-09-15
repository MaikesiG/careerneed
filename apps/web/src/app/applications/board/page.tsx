import Link from "next/link";
import ApplicationViewTabs from "@/components/ApplicationViewTabs";
import PipelineBoard, { type PipelineApplication } from "./PipelineBoard";
type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type ApplicationResponse = PipelineApplication & {
  status: ApplicationStatus;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

function isApplication(value: unknown): value is ApplicationResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const application = value as Record<string, unknown>;
  const job = application.job;

  if (!job || typeof job !== "object") {
    return false;
  }

  const jobRecord = job as Record<string, unknown>;

  return (
    typeof application.id === "string" &&
    typeof application.job_id === "string" &&
    isApplicationStatus(application.status) &&
    (application.follow_up_on === null || typeof application.follow_up_on === "string") &&
    typeof jobRecord.id === "string" &&
    typeof jobRecord.company_name === "string" &&
    typeof jobRecord.title === "string"
  );
}

async function getApplications(): Promise<PipelineApplication[] | null> {
  try {
    const response = await fetch(`${API_URL}/applications?limit=100`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();

    return Array.isArray(data) && data.every(isApplication) ? data : null;
  } catch {
    return null;
  }
}

function localDateKey(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export default async function ApplicationsBoardPage() {
  const applications = await getApplications();

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

        {applications === null ? (
          <section className="border-border bg-card mt-8 rounded-2xl border border-dashed p-8">
            <h2 className="text-lg font-semibold">Pipeline is temporarily unavailable</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
              We could not load your applications. You can still return to the dashboard or try
              again after the API reconnects.
            </p>
            <Link
              href="/applications"
              className="text-primary mt-4 inline-flex text-sm font-semibold transition hover:opacity-80"
            >
              View applications <span aria-hidden="true">&nbsp;→</span>
            </Link>
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
