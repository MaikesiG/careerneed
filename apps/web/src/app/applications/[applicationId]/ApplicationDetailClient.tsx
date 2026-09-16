"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import ApplicationContactsEditor from "./ApplicationContactsEditor";
import ApplicationFollowUpEditor from "./ApplicationFollowUpEditor";
import ApplicationNotesEditor from "./ApplicationNotesEditor";
import ApplicationStatusEditor from "./ApplicationStatusEditor";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type ApplicationDetail = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  follow_up_on: string | null;
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

type ApplicationDetailClientProps = {
  applicationId: string;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function formatStatus(status: ApplicationStatus): string {
  if (status === "saved") return "Saved";
  if (status === "applied") return "Applied";
  if (status === "interviewing") return "Interviewing";
  if (status === "offer") return "Offer";
  if (status === "rejected") return "Rejected";
  return "Withdrawn";
}

function statusClass(status: ApplicationStatus): string {
  if (status === "saved" || status === "interviewing") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  if (status === "applied") {
    return "border-success-border bg-success-background text-success";
  }

  if (status === "offer") {
    return "border-warning-border bg-warning-background text-warning";
  }

  if (status === "rejected") {
    return "border-error-border bg-error-background text-destructive";
  }

  return "border-border bg-muted text-muted-foreground";
}

function sourceLabel(source: string): string {
  const normalized = source.trim().toLowerCase();

  if (normalized === "greenhouse") return "Greenhouse";
  if (normalized === "lever") return "Lever";
  if (normalized === "ashby") return "Ashby";
  if (normalized === "manual") return "Manual";

  return source;
}

function sourceClass(source: string): string {
  const normalized = source.trim().toLowerCase();

  if (normalized === "greenhouse") {
    return "border-success-border bg-success-background text-success";
  }

  if (normalized === "manual") {
    return "border-warning-border bg-warning-background text-warning";
  }

  if (normalized === "lever" || normalized === "ashby") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  return "border-border bg-muted text-muted-foreground";
}

export default function ApplicationDetailClient({ applicationId }: ApplicationDetailClientProps) {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadApplication() {
      setApplication(null);
      setError(null);
      setIsNotFound(false);

      try {
        const response = await apiFetch(`/applications/${applicationId}`, {
          cache: "no-store",
        });

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          router.push(`/login?next=/applications/${applicationId}`);
          return;
        }

        if (response.status === 404) {
          setIsNotFound(true);
          return;
        }

        if (!response.ok) {
          throw new Error(
            await getApiErrorMessage(response, "Unable to load application details.")
          );
        }

        setApplication((await response.json()) as ApplicationDetail);
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load application details."
          );
        }
      }
    }

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [applicationId, router]);

  if (isNotFound) {
    return (
      <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            className="text-primary inline-flex text-sm font-semibold transition hover:opacity-80"
            href="/applications"
          >
            ← Back to applications
          </Link>

          <section className="border-border bg-card mt-6 rounded-2xl border border-dashed p-8">
            <h1 className="text-xl font-semibold">Application not found</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              It may have been deleted or is not available for this account.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link
            className="text-primary inline-flex text-sm font-semibold transition hover:opacity-80"
            href="/applications"
          >
            ← Back to applications
          </Link>

          <section className="border-error-border bg-error-background text-destructive mt-6 rounded-2xl border p-8">
            <h1 className="text-xl font-semibold">Application details are unavailable</h1>
            <p className="mt-2 text-sm">{error}</p>
          </section>
        </div>
      </main>
    );
  }

  if (!application) {
    return (
      <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="border-border bg-card rounded-2xl border border-dashed p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">Loading application details…</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          className="text-primary inline-flex text-sm font-semibold transition hover:opacity-80"
          href="/applications"
        >
          ← Back to applications
        </Link>

        <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
                {application.job.company_name}
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {application.job.title}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                    application.status
                  )}`}
                >
                  {formatStatus(application.status)}
                </span>

                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${sourceClass(
                    application.job.source
                  )}`}
                >
                  {sourceLabel(application.job.source)}
                </span>

                {application.job.workplace_type ? (
                  <span className="border-border bg-muted text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-semibold">
                    {application.job.workplace_type}
                  </span>
                ) : null}
              </div>
            </div>

            <a
              className="border-border bg-card text-foreground hover:bg-muted inline-flex shrink-0 items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition"
              href={application.job.application_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              View original posting ↗
            </a>
          </div>

          <dl className="border-border mt-8 grid gap-4 border-t pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-foreground font-medium">Location</dt>
              <dd className="text-muted-foreground mt-1">
                {application.job.location ?? "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="text-foreground font-medium">Workplace type</dt>
              <dd className="text-muted-foreground mt-1">
                {application.job.workplace_type ?? "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="text-foreground font-medium">Applied</dt>
              <dd className="text-muted-foreground mt-1">{formatDate(application.applied_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Application status</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Update this stage when the application moves forward, pauses, or closes.
          </p>
          <div className="mt-5">
            <ApplicationStatusEditor
              applicationId={application.id}
              initialStatus={application.status}
            />
          </div>
        </section>

        <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Follow-up</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Set a date so you know when to contact a recruiter or check on the application.
          </p>
          <div className="mt-5">
            <ApplicationFollowUpEditor
              applicationId={application.id}
              initialFollowUpOn={application.follow_up_on}
            />
          </div>
        </section>

        <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Notes</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Keep recruiter messages, interview context, and follow-up details in one place.
          </p>
          <div className="mt-5">
            <ApplicationNotesEditor
              applicationId={application.id}
              initialNotes={application.notes ?? ""}
            />
          </div>
        </section>

        <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Contacts</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Track recruiters, hiring managers, referrals, and interviewers for this application.
          </p>
          <div className="mt-5">
            <ApplicationContactsEditor applicationId={application.id} />
          </div>
        </section>
      </div>
    </main>
  );
}
