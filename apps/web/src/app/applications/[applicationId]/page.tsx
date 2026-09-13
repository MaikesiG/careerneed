import Link from "next/link";
import { notFound } from "next/navigation";
import ApplicationNotesEditor from "./ApplicationNotesEditor";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type ApplicationDetail = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
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
  if (status === "saved") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (status === "applied") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "interviewing") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (status === "offer") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
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
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (normalized === "lever") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (normalized === "ashby") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (normalized === "manual") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

type ApplicationPageProps = {
  params: Promise<{
    applicationId: string;
  }>;
};

export default async function ApplicationPage({ params }: ApplicationPageProps) {
  const { applicationId } = await params;

  const response = await fetch(`${API_URL}/applications/${applicationId}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    notFound();
  }

  if (!response.ok) {
    throw new Error("Unable to load application details.");
  }

  const application = (await response.json()) as ApplicationDetail;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          className="inline-flex text-sm font-semibold text-indigo-700 transition hover:text-indigo-900"
          href="/applications"
        >
          ← Back to applications
        </Link>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-[0.2em] text-indigo-600 uppercase">
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
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {application.job.workplace_type}
                  </span>
                ) : null}
              </div>
            </div>

            <a
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
              href={application.job.application_url}
              rel="noopener noreferrer"
              target="_blank"
            >
              View original posting ↗
            </a>
          </div>

          <dl className="mt-8 grid gap-4 border-t border-slate-200 pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium text-slate-700">Location</dt>
              <dd className="mt-1 text-slate-600">{application.job.location ?? "Not specified"}</dd>
            </div>

            <div>
              <dt className="font-medium text-slate-700">Workplace type</dt>
              <dd className="mt-1 text-slate-600">
                {application.job.workplace_type ?? "Not specified"}
              </dd>
            </div>

            <div>
              <dt className="font-medium text-slate-700">Applied</dt>
              <dd className="mt-1 text-slate-600">{formatDate(application.applied_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold">Notes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Keep recruiter messages, interview context, and follow-up details in one place.
          </p>

          <div className="mt-5">
            <ApplicationNotesEditor
              applicationId={application.id}
              initialNotes={application.notes ?? ""}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
