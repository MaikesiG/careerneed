"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "withdrawn";

type ApplicationStatusEditorProps = {
  applicationId: string;
  initialStatus: ApplicationStatus;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

export default function ApplicationStatusEditor({
  applicationId,
  initialStatus,
}: ApplicationStatusEditorProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasChanges = status !== initialStatus;

  async function saveStatus() {
    if (!hasChanges || isSaving) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Unable to update application status.");
      }

      setMessage("Status updated.");
      router.refresh();
    } catch {
      setMessage("Unable to update status. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        void saveStatus();
      }}
    >
      <div className="min-w-0 w-full sm:w-80">
        <label className="text-foreground text-sm font-medium" htmlFor="application-status">
          Current status
        </label>
        <select
          id="application-status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ApplicationStatus);
            setMessage(null);
          }}
          disabled={isSaving}
          className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-2 w-full rounded-lg border px-3 py-2.5 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={!hasChanges || isSaving}
        className="bg-primary text-primary-foreground focus-visible:ring-primary focus-visible:ring-offset-background inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : "Save status"}
      </button>

      {message ? (
        <p
          className={`text-sm sm:mb-2 ${
            message === "Status updated." ? "text-success" : "text-destructive"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
