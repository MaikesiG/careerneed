import Link from "next/link";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type Application = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  follow_up_on: string | null;
  updated_at: string;
  job: {
    company_name: string;
    source: string;
    title: string;
    location: string | null;
    workplace_type: string | null;
    application_url: string;
  };
};

type FollowUpFilter = "all" | "today" | "overdue" | "scheduled";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  if (status === "applied") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "interviewing") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "offer") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "saved") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
function applicationHref(status: ApplicationStatus | null, followUp: FollowUpFilter): string {
  const params = new URLSearchParams();

  if (status) {
    params.set("status", status);
  }

  if (followUp !== "all") {
    params.set("follow_up", followUp);
  }

  const query = params.toString();

  return query ? `/applications?${query}` : "/applications";
}

async function getApplications(
  status: ApplicationStatus | null,
  followUp: FollowUpFilter
): Promise<Application[]> {
  const params = new URLSearchParams({ limit: "100" });

  if (status) {
    params.set("status", status);
  }

  if (followUp !== "all") {
    params.set("follow_up", followUp);
  }
  try {
    const response = await fetch(`${API_URL}/applications?${params.toString()}`, {
      cache: "no-store",
    });
    return response.ok ? ((await response.json()) as Application[]) : [];
  } catch {
    return [];
  }
}

function getFollowUpLabel(value: string | null): {
  label: string;
  className: string;
} | null {
  if (!value) {
    return null;
  }

  const today = new Date();
  const localToday = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  if (value === localToday) {
    return {
      label: "Follow up today",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (value < localToday) {
    return {
      label: "Follow-up overdue",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label: `Follow up ${formatDate(value)}`,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    follow_up?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const requestedStatus = Array.isArray(resolvedSearchParams.status)
    ? resolvedSearchParams.status[0]
    : resolvedSearchParams.status;
  const selectedStatus = STATUS_OPTIONS.some((option) => option.value === requestedStatus)
    ? (requestedStatus as ApplicationStatus)
    : null;
  const requestedFollowUp = Array.isArray(resolvedSearchParams.follow_up)
    ? resolvedSearchParams.follow_up[0]
    : resolvedSearchParams.follow_up;

  const selectedFollowUp = FOLLOW_UP_OPTIONS.some((option) => option.value === requestedFollowUp)
    ? (requestedFollowUp as FollowUpFilter)
    : "all";
  const applications = await getApplications(selectedStatus, selectedFollowUp);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-indigo-600 uppercase">
              CareerNeed
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My applications</h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Track every role you saved or applied to. Results are ordered by most recently
              updated.
            </p>
          </div>
          <Link
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            href="/jobs"
          >
            Browse jobs
          </Link>
        </header>

        <nav aria-label="Application status filters" className="mb-3 flex flex-wrap gap-2">
          <Link
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              selectedStatus === null
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            href={applicationHref(null, selectedFollowUp)}
          >
            All statuses
          </Link>
          {STATUS_OPTIONS.map((option) => (
            <Link
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                selectedStatus === option.value
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              href={applicationHref(option.value, selectedFollowUp)}
              key={option.value}
            >
              {option.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Follow-up filters" className="mb-6 flex flex-wrap gap-2">
          {FOLLOW_UP_OPTIONS.map((option) => (
            <Link
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                selectedFollowUp === option.value
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              href={applicationHref(selectedStatus, option.value)}
              key={option.value}
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <p className="mb-4 text-sm text-slate-600">{applications.length} tracked jobs</p>

        {applications.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold">No tracked jobs here yet</h2>
            <p className="mt-2 text-sm text-slate-600">
              Choose a tracking status from any job card to start your workflow.
            </p>
          </section>
        ) : (
          <section className="grid gap-4">
            {applications.map((application) => {
              const followUp = getFollowUpLabel(application.follow_up_on);

              return (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  key={application.id}
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{application.job.title}</h2>
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
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {application.job.company_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {application.job.location ?? "Location not specified"}
                      </p>
                      {application.notes ? (
                        <p className="mt-3 text-sm whitespace-pre-wrap text-slate-600">
                          {application.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex h-fit shrink-0 flex-wrap gap-2">
                      <Link
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        href={`/applications/${application.id}`}
                      >
                        View details
                      </Link>

                      <a
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        href={application.job.application_url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        View posting
                      </a>
                    </div>
                  </div>
                  <footer className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-4 text-sm text-slate-500">
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
      </div>
    </main>
  );
}
