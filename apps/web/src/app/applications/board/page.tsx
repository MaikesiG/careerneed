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

type PipelineColumnKey = "saved" | "applied" | "interviewing" | "offer" | "closed";

type PipelineColumn = {
  key: PipelineColumnKey;
  title: string;
  description: string;
  statuses: ApplicationStatus[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    key: "saved",
    title: "Saved",
    description: "Roles to review or apply for.",
    statuses: ["saved"],
  },
  {
    key: "applied",
    title: "Applied",
    description: "Submitted and awaiting a response.",
    statuses: ["applied"],
  },
  {
    key: "interviewing",
    title: "Interviewing",
    description: "Roles currently in the interview process.",
    statuses: ["interviewing"],
  },
  {
    key: "offer",
    title: "Offer",
    description: "Offers to review and decide on.",
    statuses: ["offer"],
  },
  {
    key: "closed",
    title: "Closed",
    description: "Rejected or withdrawn applications.",
    statuses: ["rejected", "withdrawn"],
  },
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

function isApplication(value: unknown): value is Application {
  if (!value || typeof value !== "object") {
    return false;
  }

  const application = value as Record<string, unknown>;
  const job = application.job as Record<string, unknown> | null;

  return (
    typeof application.id === "string" &&
    typeof application.job_id === "string" &&
    isApplicationStatus(application.status) &&
    (application.follow_up_on === null || typeof application.follow_up_on === "string") &&
    Boolean(job) &&
    typeof job?.id === "string" &&
    typeof job?.company_name === "string" &&
    typeof job?.title === "string"
  );
}

async function getApplications(): Promise<Application[] | null> {
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

function statusLabel(status: ApplicationStatus): string {
  if (status === "saved") return "Saved";
  if (status === "applied") return "Applied";
  if (status === "interviewing") return "Interviewing";
  if (status === "offer") return "Offer";
  if (status === "rejected") return "Rejected";
  return "Withdrawn";
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

  if (status === "rejected") {
    return "border-error-border bg-error-background text-destructive";
  }

  return "border-border bg-muted text-muted-foreground";
}

function localDateKey(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function followUpLabel(value: string | null): {
  label: string;
  className: string;
} | null {
  if (!value) {
    return null;
  }

  const today = localDateKey();

  if (value === today) {
    return {
      label: "Follow up today",
      className: "border-warning-border bg-warning-background text-warning",
    };
  }

  if (value < today) {
    return {
      label: "Follow-up overdue",
      className: "border-error-border bg-error-background text-destructive",
    };
  }

  return {
    label: `Follow up ${value}`,
    className: "border-border bg-muted text-muted-foreground",
  };
}

export default async function ApplicationsBoardPage() {
  const applications = await getApplications();

  const applicationsByColumn: Record<PipelineColumnKey, Application[]> = {
    saved: [],
    applied: [],
    interviewing: [],
    offer: [],
    closed: [],
  };

  if (applications) {
    for (const application of applications) {
      const column = PIPELINE_COLUMNS.find((candidate) =>
        candidate.statuses.includes(application.status)
      );

      if (column) {
        applicationsByColumn[column.key].push(application);
      }
    }
  }

  const totalApplications = applications?.length ?? 0;

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

          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition"
            >
              Dashboard
            </Link>
            <Link
              href="/applications"
              className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            >
              List view
            </Link>
          </div>
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
            <p className="text-muted-foreground mt-8 text-sm">
              {totalApplications} tracked {totalApplications === 1 ? "job" : "jobs"}
            </p>

            <section
              className="mt-4 flex gap-4 overflow-x-auto pb-4"
              aria-label="Application pipeline"
            >
              {PIPELINE_COLUMNS.map((column) => {
                const columnApplications = applicationsByColumn[column.key];

                return (
                  <section
                    className="border-border bg-card w-72 shrink-0 rounded-2xl border p-4"
                    key={column.key}
                    aria-labelledby={`${column.key}-heading`}
                  >
                    <div className="border-border border-b pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 id={`${column.key}-heading`} className="text-lg font-semibold">
                            {column.title}
                          </h2>
                          <p className="text-muted-foreground mt-1 text-sm leading-5">
                            {column.description}
                          </p>
                        </div>
                        <span className="bg-muted text-primary flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold">
                          {columnApplications.length}
                        </span>
                      </div>
                    </div>

                    {columnApplications.length === 0 ? (
                      <p className="text-muted-foreground py-6 text-sm">No applications here.</p>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {columnApplications.map((application) => {
                          const followUp = followUpLabel(application.follow_up_on);

                          return (
                            <Link
                              href={`/applications/${application.id}`}
                              key={application.id}
                              className="group border-border bg-background hover:border-primary/50 hover:bg-muted rounded-xl border p-4 transition"
                            >
                              <p className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                                {application.job.company_name}
                              </p>
                              <h3 className="group-hover:text-primary mt-1 line-clamp-2 text-sm font-semibold">
                                {application.job.title}
                              </h3>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span
                                  className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(
                                    application.status
                                  )}`}
                                >
                                  {statusLabel(application.status)}
                                </span>

                                {followUp ? (
                                  <span
                                    className={`rounded-full border px-2 py-1 text-xs font-semibold ${followUp.className}`}
                                  >
                                    {followUp.label}
                                  </span>
                                ) : null}
                              </div>

                              {application.job.location ? (
                                <p className="text-muted-foreground mt-3 truncate text-xs">
                                  {application.job.location}
                                </p>
                              ) : null}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
