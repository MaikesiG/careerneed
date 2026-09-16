"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/dist/client/components/navigation";

import { FormEvent, useState } from "react";

type ApplicationFollowUpEditorProps = {
  applicationId: string;
  initialFollowUpOn: string | null;
};

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }

  return fallback;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    return getErrorMessage(await response.json(), fallback);
  } catch {
    return fallback;
  }
}

function dateInputValue(daysFromToday: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function ApplicationFollowUpEditor({
  applicationId,
  initialFollowUpOn,
}: ApplicationFollowUpEditorProps) {
  const router = useRouter();
  const [followUpOn, setFollowUpOn] = useState(initialFollowUpOn ?? "");
  const [savedFollowUpOn, setSavedFollowUpOn] = useState(initialFollowUpOn ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasChanges = followUpOn !== savedFollowUpOn;

  function scheduleFor(daysFromToday: number) {
    setFollowUpOn(dateInputValue(daysFromToday));
    setError(null);
    setNotice(null);
  }

  async function saveFollowUp(nextFollowUpOn: string) {
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await apiFetch(`/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          follow_up_on: nextFollowUpOn || null,
        }),
      });

      if (response.status === 401) {
        router.push(`/login?next=/applications/${applicationId}`);
        return;
      }
      if (!response.ok) {
        throw new Error(await readError(response, "Unable to save follow-up date."));
      }

      const updated = (await response.json()) as {
        follow_up_on: string | null;
      };

      const updatedValue = updated.follow_up_on ?? "";
      setFollowUpOn(updatedValue);
      setSavedFollowUpOn(updatedValue);
      setNotice(updatedValue ? "Follow-up date saved." : "Follow-up cleared.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to save follow-up date."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges || isSaving) {
      return;
    }

    await saveFollowUp(followUpOn);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <div
          className="border-error-border bg-error-background text-destructive rounded-xl border px-4 py-3 text-sm"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className="border-success-border bg-success-background text-success rounded-xl border px-4 py-3 text-sm"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <label className="text-foreground grid gap-2 text-sm font-medium">
        Follow-up date
        <input
          className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 h-10 max-w-xs rounded-lg border px-3 text-sm transition outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          onChange={(event) => {
            setFollowUpOn(event.target.value);
            setError(null);
            setNotice(null);
          }}
          type="date"
          value={followUpOn}
        />
      </label>

      <fieldset disabled={isSaving}>
        <legend className="text-foreground text-sm font-medium">Quick schedule</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => scheduleFor(1)}
            type="button"
          >
            Tomorrow
          </button>
          <button
            className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => scheduleFor(7)}
            type="button"
          >
            Next week
          </button>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || !hasChanges}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save follow-up"}
        </button>

        {savedFollowUpOn ? (
          <button
            className="border-border bg-card text-foreground hover:bg-muted rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            onClick={() => {
              void saveFollowUp("");
            }}
            type="button"
          >
            Clear follow-up
          </button>
        ) : null}

        <p className="text-muted-foreground text-sm">
          {hasChanges ? "Unsaved changes" : "All changes saved"}
        </p>
      </div>
    </form>
  );
}
