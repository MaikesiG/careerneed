"use client";

import Link from "next/link";
import { useState } from "react";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

export type PipelineApplication = {
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

const CLOSED_VISIBLE_COUNT = 3;

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
  needsAttention: boolean;
} | null {
  if (!value) {
    return null;
  }

  const today = localDateKey();

  if (value === today) {
    return {
      label: "Due today",
      className: "border-warning-border bg-warning-background text-warning",
      needsAttention: true,
    };
  }

  if (value < today) {
    return {
      label: "Overdue",
      className: "border-error-border bg-error-background text-destructive",
      needsAttention: true,
    };
  }

  return {
    label: `Follow up ${value}`,
    className: "border-border bg-muted text-muted-foreground",
    needsAttention: false,
  };
}

function columnClass(column: PipelineColumn): string {
  if (column.key === "interviewing") {
    return "border-primary/40 bg-primary/5";
  }

  if (column.key === "offer") {
    return "border-warning-border bg-warning-background";
  }

  if (column.key === "closed") {
    return "border-border bg-muted/40";
  }

  return "border-border bg-card";
}

function ColumnCard({ application }: { application: PipelineApplication }) {
  const followUp = followUpLabel(application.follow_up_on);

  return (
    <Link
      href={`/applications/${application.id}`}
      className="group border-border bg-background hover:border-primary/50 hover:bg-muted focus-visible:ring-primary rounded-xl border p-4 transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
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
        <p className="text-muted-foreground mt-3 truncate text-xs">{application.job.location}</p>
      ) : null}
    </Link>
  );
}

type PipelineBoardProps = {
  applications: PipelineApplication[];
};

export default function PipelineBoard({ applications }: PipelineBoardProps) {
  const [showAllClosed, setShowAllClosed] = useState(false);

  const applicationsByColumn: Record<PipelineColumnKey, PipelineApplication[]> = {
    saved: [],
    applied: [],
    interviewing: [],
    offer: [],
    closed: [],
  };

  for (const application of applications) {
    const column = PIPELINE_COLUMNS.find((candidate) =>
      candidate.statuses.includes(application.status)
    );

    if (column) {
      applicationsByColumn[column.key].push(application);
    }
  }

  return (
    <section className="mt-4 flex gap-4 overflow-x-auto pb-4" aria-label="Application pipeline">
      {PIPELINE_COLUMNS.map((column) => {
        const columnApplications = applicationsByColumn[column.key];
        const attentionCount = columnApplications.filter((application) => {
          const followUp = followUpLabel(application.follow_up_on);
          return followUp?.needsAttention ?? false;
        }).length;

        const visibleApplications =
          column.key === "closed" && !showAllClosed
            ? columnApplications.slice(0, CLOSED_VISIBLE_COUNT)
            : columnApplications;

        const hiddenClosedCount =
          column.key === "closed"
            ? Math.max(0, columnApplications.length - CLOSED_VISIBLE_COUNT)
            : 0;

        return (
          <section
            className={`w-72 shrink-0 rounded-2xl border p-4 ${columnClass(column)}`}
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

              {attentionCount > 0 ? (
                <p className="text-destructive mt-3 text-xs font-semibold">
                  {attentionCount} follow-up{attentionCount === 1 ? "" : "s"} need
                  {attentionCount === 1 ? "s" : ""} attention
                </p>
              ) : null}
            </div>

            {columnApplications.length === 0 ? (
              <p className="text-muted-foreground py-6 text-sm">No applications here.</p>
            ) : (
              <>
                <div className="mt-4 grid gap-3">
                  {visibleApplications.map((application) => (
                    <ColumnCard application={application} key={application.id} />
                  ))}
                </div>

                {column.key === "closed" && hiddenClosedCount > 0 ? (
                  <button
                    className="border-border bg-background text-foreground hover:bg-muted focus-visible:ring-primary mt-4 w-full rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                    onClick={() => setShowAllClosed((current) => !current)}
                    type="button"
                  >
                    {showAllClosed
                      ? "Show less"
                      : `Show ${hiddenClosedCount} more closed application${
                          hiddenClosedCount === 1 ? "" : "s"
                        }`}
                  </button>
                ) : null}
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}
