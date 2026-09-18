"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, FollowUpType, InterviewFollowUp } from "@/lib/api";

type Props = {
  applicationId: string;
  interviewId: string;
};

type FollowUpForm = {
  title: string;
  type: FollowUpType;
  due_at_local: string;
  timezone: string;
  notes: string;
};

const TYPE_OPTIONS: { value: FollowUpType; label: string }[] = [
  { value: "thank_you", label: "Thank-you" },
  { value: "status_check", label: "Status check" },
  { value: "recruiter_reply", label: "Recruiter reply" },
  { value: "preparation", label: "Preparation" },
  { value: "custom", label: "Custom" },
];

const controlClass =
  "border-border bg-background text-foreground focus:border-primary mt-1 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20";

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function emptyForm(): FollowUpForm {
  return {
    title: "",
    type: "thank_you",
    due_at_local: "",
    timezone: browserTimezone(),
    notes: "",
  };
}

function typeLabel(type: FollowUpType): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): DateParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    };
  } catch {
    return null;
  }
}

function serializeZonedDatetime(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isValidTimezone(timeZone)) {
    throw new Error("Enter a valid due date, time, and IANA timezone.");
  }
  const target: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  const targetEpoch = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute
  );
  const calendarCheck = new Date(targetEpoch);
  if (
    calendarCheck.getUTCFullYear() !== target.year ||
    calendarCheck.getUTCMonth() + 1 !== target.month ||
    calendarCheck.getUTCDate() !== target.day ||
    target.hour > 23 ||
    target.minute > 59
  ) {
    throw new Error("Enter a valid due date and time.");
  }

  let candidate = targetEpoch;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    if (!actual) throw new Error("Enter a valid IANA timezone.");
    const actualEpoch = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    candidate += targetEpoch - actualEpoch;
  }
  const verified = zonedParts(new Date(candidate), timeZone);
  if (
    !verified ||
    verified.year !== target.year ||
    verified.month !== target.month ||
    verified.day !== target.day ||
    verified.hour !== target.hour ||
    verified.minute !== target.minute
  ) {
    throw new Error("That local time does not exist in the selected timezone.");
  }
  return new Date(candidate).toISOString();
}

function toDatetimeInput(value: string, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = zonedParts(date, timeZone);
  if (!parts) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function formatTimestamp(value: string, timeZone?: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone && isValidTimezone(timeZone) ? { timeZone } : {}),
    }).format(date);
  } catch {
    return "Date unavailable";
  }
}

function sortFollowUps(items: InterviewFollowUp[]): InterviewFollowUp[] {
  return [...items].sort((left, right) => {
    const leftDue = new Date(left.due_at_utc).getTime();
    const rightDue = new Date(right.due_at_utc).getTime();
    if (!Number.isNaN(leftDue) && !Number.isNaN(rightDue) && leftDue !== rightDue) {
      return leftDue - rightDue;
    }
    return left.created_at.localeCompare(right.created_at);
  });
}

export default function InterviewFollowUpsSection({ applicationId, interviewId }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [followUps, setFollowUps] = useState<InterviewFollowUp[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewFollowUp | null>(null);
  const [form, setForm] = useState<FollowUpForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const updateInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const endpoint = `/applications/${applicationId}/follow-ups`;

  const loadFollowUps = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch(
        `${endpoint}?interview_id=${encodeURIComponent(interviewId)}`
      );
      if (!response.ok) throw new Error("request failed");
      setFollowUps((await response.json()) as InterviewFollowUp[]);
      setHasLoaded(true);
    } catch {
      setLoadError("Unable to load follow-ups. Please try again.");
    } finally {
      loadInFlight.current = false;
      setIsLoading(false);
    }
  }, [endpoint, interviewId]);

  useEffect(() => {
    if (!isExpanded || hasLoaded || loadError) return;
    // Lazy-load once for this mounted interview card.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFollowUps();
  }, [hasLoaded, isExpanded, loadError, loadFollowUps]);

  useEffect(() => {
    if (!isEditorOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const firstControl = dialogRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button"
    );
    firstControl?.focus();
    return () => previousFocusRef.current?.focus();
  }, [isEditorOpen]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setActionError(null);
    setIsEditorOpen(true);
  }

  function openEdit(followUp: InterviewFollowUp) {
    setEditing(followUp);
    setForm({
      title: followUp.title,
      type: followUp.type,
      due_at_local: toDatetimeInput(followUp.due_at_utc, followUp.timezone),
      timezone: followUp.timezone,
      notes: followUp.notes ?? "",
    });
    setFormError(null);
    setActionError(null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (!saveInFlight.current) setIsEditorOpen(false);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlight.current) return;
    const title = form.title.trim();
    const timezone = form.timezone.trim();
    if (!title) {
      setFormError("Title is required.");
      return;
    }
    if (title.length > 255 || form.notes.trim().length > 10_000) {
      setFormError("Title or notes exceed the allowed length.");
      return;
    }
    let dueAtUtc: string;
    try {
      dueAtUtc = serializeZonedDatetime(form.due_at_local, timezone);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Enter a valid due date and time.");
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setFormError(null);
    setActionError(null);
    try {
      const response = await apiFetch(editing ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editing ? {} : { interview_id: interviewId }),
          title,
          type: form.type,
          due_at_utc: dueAtUtc,
          timezone,
          notes: form.notes.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("request failed");
      const saved = (await response.json()) as InterviewFollowUp;
      setFollowUps((current) =>
        sortFollowUps(
          editing
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved]
        )
      );
      setHasLoaded(true);
      setIsEditorOpen(false);
    } catch {
      setFormError("Unable to save this follow-up. Please try again.");
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  }

  async function toggleCompletion(followUp: InterviewFollowUp) {
    if (updateInFlight.current) return;
    updateInFlight.current = true;
    setUpdatingId(followUp.id);
    setActionError(null);
    try {
      const response = await apiFetch(`${endpoint}/${followUp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed_at: followUp.completed_at ? null : new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error("request failed");
      const updated = (await response.json()) as InterviewFollowUp;
      setFollowUps((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch {
      setActionError("Unable to update this follow-up. Please try again.");
    } finally {
      updateInFlight.current = false;
      setUpdatingId(null);
    }
  }

  async function deleteFollowUp(followUp: InterviewFollowUp) {
    if (deleteInFlight.current) return;
    if (!window.confirm(`Delete “${followUp.title}”? This cannot be undone.`)) return;
    deleteInFlight.current = true;
    setDeletingId(followUp.id);
    setActionError(null);
    try {
      const response = await apiFetch(`${endpoint}/${followUp.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("request failed");
      setFollowUps((current) => current.filter((item) => item.id !== followUp.id));
    } catch {
      setActionError("Unable to delete this follow-up. Please try again.");
    } finally {
      deleteInFlight.current = false;
      setDeletingId(null);
    }
  }

  return (
    <div className="border-border mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        aria-controls={`follow-ups-${interviewId}`}
        className="text-foreground hover:text-primary flex h-10 w-full items-center justify-between text-left text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          Follow-ups
          {hasLoaded ? (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
              {followUps.length}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true">{isExpanded ? "▴" : "▾"}</span>
      </button>

      {isExpanded ? (
        <div id={`follow-ups-${interviewId}`} className="pt-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              Manage reminders linked only to this interview.
            </p>
            <button
              type="button"
              onClick={openCreate}
              disabled={isLoading || !hasLoaded}
              className="bg-primary text-primary-foreground h-10 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
            >
              Add follow-up
            </button>
          </div>

          {loadError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span>{loadError}</span>
              <button type="button" onClick={() => void loadFollowUps()} className="font-semibold underline">
                Retry
              </button>
            </div>
          ) : null}
          {actionError ? (
            <p className="border-destructive/30 bg-destructive/10 text-destructive mb-3 rounded-lg border px-3 py-2 text-sm">
              {actionError}
            </p>
          ) : null}
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-sm">Loading follow-ups…</p>
          ) : null}
          {!isLoading && !loadError && followUps.length === 0 ? (
            <div className="border-border bg-muted/20 rounded-lg border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-medium">No follow-ups yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Add a thank-you, status check, or preparation reminder.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {followUps.map((followUp) => {
              const isCompleted = followUp.completed_at !== null;
              return (
                <article key={followUp.id} className="border-border rounded-lg border px-3 py-3">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-foreground text-sm font-semibold">{followUp.title}</h4>
                        <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                          {typeLabel(followUp.type)}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            isCompleted
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          }`}
                        >
                          {isCompleted ? "Completed" : "Pending"}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Due {formatTimestamp(followUp.due_at_utc, followUp.timezone)}
                        {followUp.timezone ? ` · ${followUp.timezone}` : ""}
                      </p>
                      {isCompleted ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Completed {formatTimestamp(followUp.completed_at ?? "")}
                        </p>
                      ) : null}
                      {followUp.notes ? (
                        <p className="text-foreground mt-2 whitespace-pre-wrap text-sm">
                          {followUp.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={updatingId !== null || deletingId !== null}
                        onClick={() => void toggleCompletion(followUp)}
                        className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
                      >
                        {updatingId === followUp.id
                          ? "Saving…"
                          : isCompleted
                            ? "Reopen"
                            : "Mark complete"}
                      </button>
                      <button
                        type="button"
                        disabled={updatingId !== null || deletingId !== null}
                        onClick={() => openEdit(followUp)}
                        className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={updatingId !== null || deletingId !== null}
                        onClick={() => void deleteFollowUp(followUp)}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 h-10 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
                      >
                        {deletingId === followUp.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {isEditorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`follow-up-editor-title-${interviewId}`}
        >
          <div
            ref={dialogRef}
            onKeyDown={handleDialogKeyDown}
            className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id={`follow-up-editor-title-${interviewId}`} className="text-foreground text-lg font-bold">
                  {editing ? "Edit follow-up" : "Add follow-up"}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Date and time are interpreted in the IANA timezone you provide.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                aria-label="Close follow-up editor"
                className="text-muted-foreground hover:text-foreground h-10 px-2 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitFollowUp} className="mt-5 space-y-4">
              <div>
                <label htmlFor={`follow-up-title-${interviewId}`} className="text-foreground text-sm font-medium">
                  Title
                </label>
                <input
                  id={`follow-up-title-${interviewId}`}
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className={`${controlClass} h-10`}
                />
              </div>
              <div>
                <label htmlFor={`follow-up-type-${interviewId}`} className="text-foreground text-sm font-medium">
                  Type
                </label>
                <select
                  id={`follow-up-type-${interviewId}`}
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as FollowUpType })}
                  className={`${controlClass} h-10`}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`follow-up-due-${interviewId}`} className="text-foreground text-sm font-medium">
                    Due date and time
                  </label>
                  <input
                    id={`follow-up-due-${interviewId}`}
                    type="datetime-local"
                    required
                    value={form.due_at_local}
                    onChange={(event) => setForm({ ...form, due_at_local: event.target.value })}
                    className={`${controlClass} h-10`}
                  />
                </div>
                <div>
                  <label htmlFor={`follow-up-timezone-${interviewId}`} className="text-foreground text-sm font-medium">
                    IANA timezone
                  </label>
                  <input
                    id={`follow-up-timezone-${interviewId}`}
                    required
                    maxLength={100}
                    placeholder="America/New_York"
                    value={form.timezone}
                    onChange={(event) => setForm({ ...form, timezone: event.target.value })}
                    className={`${controlClass} h-10`}
                  />
                </div>
              </div>
              <div>
                <label htmlFor={`follow-up-notes-${interviewId}`} className="text-foreground text-sm font-medium">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id={`follow-up-notes-${interviewId}`}
                  rows={4}
                  maxLength={10_000}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className={`${controlClass} py-2`}
                />
              </div>
              {formError ? (
                <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {formError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={isSaving}
                  className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : editing ? "Save changes" : "Add follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
