"use client";

import { FormEvent, useState } from "react";
import { apiFetch, getApiErrorMessage } from "@/lib/api";
import { useRouter } from "next/navigation";

type ApplicationNotesEditorProps = {
  applicationId: string;
  initialNotes: string;
};

export default function ApplicationNotesEditor({
  applicationId,
  initialNotes,
}: ApplicationNotesEditorProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<string>(initialNotes);
  const [savedNotes, setSavedNotes] = useState<string>(initialNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasChanges = notes !== savedNotes;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges) return;
    setError(null);
    setNotice(null);
    setIsSaving(true);

    const encodedApplicationId = encodeURIComponent(applicationId);
    try {
      const response = await apiFetch(`/applications/${encodedApplicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (response.status === 401) {
        router.push(`/login?next=/applications/${encodedApplicationId}`);
        return;
      }

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, "Unable to save application notes."));
      }

      const updated = (await response.json()) as { notes: string | null };
      const updatedNotes = updated.notes ?? "";
      setNotes(updatedNotes);
      setSavedNotes(updatedNotes);
      setNotice("Notes saved.");
    } catch (err) {
      setError((err as Error).message ?? "Unable to save application notes.");
    } finally {
      setIsSaving(false);
    }
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
        Notes for this application
        <textarea
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 min-h-44 w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 transition outline-none focus:ring-2"
          disabled={isSaving}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotice(null);
          }}
          placeholder="Recruiter messages, interview context, follow-up notes..."
          value={notes}
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-muted-foreground text-sm">
          {hasChanges ? "Unsaved changes" : "All changes saved"}
        </span>
        <button
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          disabled={isSaving || !hasChanges}
          type="submit"
        >
          {isSaving ? "Saving…" : "Save notes"}
        </button>
      </div>
    </form>
  );
}
