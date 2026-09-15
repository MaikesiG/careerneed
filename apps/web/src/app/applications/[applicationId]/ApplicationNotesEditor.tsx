"use client";

import { FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ApplicationNotesEditorProps = {
  applicationId: string;
  initialNotes: string;
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

export default function ApplicationNotesEditor({
  applicationId,
  initialNotes,
}: ApplicationNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasChanges = notes !== savedNotes;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasChanges) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await fetch(`${API_URL}/applications/${applicationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Unable to save application notes."));
      }

      const updated = (await response.json()) as { notes: string | null };
      const updatedNotes = updated.notes ?? "";

      setNotes(updatedNotes);
      setSavedNotes(updatedNotes);
      setNotice("Notes saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to save application notes."
      );
    } finally {
      setIsSaving(false);
    }
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
        Notes for this application
        <textarea
          className="min-h-44 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm leading-6 text-foreground transition outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          disabled={isSaving}
          onChange={(event) => {
            setNotes(event.target.value);
            setNotice(null);
          }}
          placeholder={
            "Recruiter contacted me.\nTechnical interview next week.\nFollow up on Friday."
          }
          value={notes}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasChanges ? "Unsaved changes" : "All changes saved"}
        </p>

        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSaving || !hasChanges}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save notes"}
        </button>
      </div>
    </form>
  );
}
