"use client";

import { FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export default function ApplicationFollowUpEditor({
  applicationId,
  initialFollowUpOn,
}: ApplicationFollowUpEditorProps) {
  const [followUpOn, setFollowUpOn] = useState(initialFollowUpOn ?? "");
  const [savedFollowUpOn, setSavedFollowUpOn] = useState(initialFollowUpOn ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasChanges = followUpOn !== savedFollowUpOn;

  async function saveFollowUp(nextFollowUpOn: string) {
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch(`${API_URL}/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          follow_up_on: nextFollowUpOn || null,
        }),
      });

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

    if (!hasChanges) {
      return;
    }

    await saveFollowUp(followUpOn);
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {error ? (
        <div
          className="rounded-xl border border-error-border bg-error-background px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          className="rounded-xl border border-success-border bg-success-background px-4 py-3 text-sm text-success"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-foreground">
        Follow-up date
        <input
          className="h-10 max-w-xs rounded-lg border border-border bg-background px-3 text-sm text-foreground transition outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          onChange={(event) => {
            setFollowUpOn(event.target.value);
            setNotice(null);
          }}
          type="date"
          value={followUpOn}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || !hasChanges}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save follow-up"}
        </button>

        {savedFollowUpOn ? (
          <button
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving}
            onClick={() => {
              void saveFollowUp("");
            }}
            type="button"
          >
            Clear follow-up
          </button>
        ) : null}

        <p className="text-sm text-muted-foreground">
          {hasChanges ? "Unsaved changes" : "All changes saved"}
        </p>
      </div>
    </form>
  );
}
