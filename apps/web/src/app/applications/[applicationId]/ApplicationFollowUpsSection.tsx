"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { apiFetch, FollowUpType, Interview, InterviewFollowUp } from "@/lib/api";
import {
  browserTimezone,
  formatTimestamp,
  serializeZonedDatetime,
  toDatetimeInput,
} from "@/lib/followUpTime";

type Props = {
  applicationId: string;
  followUpsRevision: number;
  onFollowUpsChanged: () => void;
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

function emptyForm(): FollowUpForm {
  return {
    title: "",
    type: "status_check",
    due_at_local: "",
    timezone: browserTimezone(),
    notes: "",
  };
}

function typeLabel(type: FollowUpType): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
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

export function interviewContextLabel(
  followUp: Pick<InterviewFollowUp, "interview_id">,
  interview: Pick<Interview, "round" | "title"> | undefined
): string {
  if (!followUp.interview_id) return "Application";
  if (!interview) return "Interview follow-up";

  const title = interview.title.trim();
  const round = Number.isInteger(interview.round) && interview.round > 0
    ? `Round ${interview.round}`
    : "";
  if (round && title) return `Interview · ${round} · ${title}`;
  if (round || title) return `Interview · ${round || title}`;
  return "Interview follow-up";
}

export default function ApplicationFollowUpsSection({
  applicationId,
  followUpsRevision,
  onFollowUpsChanged,
}: Props) {
  const dialogTitleId = useId();
  const [followUps, setFollowUps] = useState<InterviewFollowUp[]>([]);
  const [interviewsById, setInterviewsById] = useState<Record<string, Interview>>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InterviewFollowUp | null>(null);
  const [form, setForm] = useState<FollowUpForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<InterviewFollowUp | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const mountedRef = useRef(true);
  const loadInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const mutationInFlight = useRef<Set<string>>(new Set());
  const activeLoadController = useRef<AbortController | null>(null);
  const lastSeenRevisionRef = useRef(followUpsRevision);
  const selfNotificationsRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const endpoint = `/applications/${encodeURIComponent(applicationId)}/follow-ups`;

  const setItemPending = useCallback((id: string, pending: boolean) => {
    if (!mountedRef.current) return;
    setPendingIds((current) => {
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const loadFollowUps = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    const controller = new AbortController();
    activeLoadController.current = controller;
    setIsLoading(true);
    setLoadError(null);

    try {
      const [followUpsResult, interviewsResult] = await Promise.allSettled([
        apiFetch(endpoint, { cache: "no-store", signal: controller.signal }),
        apiFetch(`/applications/${encodeURIComponent(applicationId)}/interviews`, {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (!mountedRef.current || controller.signal.aborted) return;
      if (followUpsResult.status === "rejected" || !followUpsResult.value.ok) {
        throw new Error("request failed");
      }

      const loadedFollowUps = (await followUpsResult.value.json()) as InterviewFollowUp[];
      if (!mountedRef.current || controller.signal.aborted) return;
      setFollowUps(sortFollowUps(loadedFollowUps));
      setHasLoaded(true);

      if (interviewsResult.status === "fulfilled" && interviewsResult.value.ok) {
        try {
          const interviews = (await interviewsResult.value.json()) as Interview[];
          if (!mountedRef.current || controller.signal.aborted) return;
          setInterviewsById(
            Object.fromEntries(interviews.map((interview) => [interview.id, interview]))
          );
        } catch {
          // Follow-ups remain usable with the neutral interview-label fallback.
        }
      }
    } catch {
      if (mountedRef.current && !controller.signal.aborted) {
        setLoadError("Unable to load follow-ups. Please try again.");
      }
    } finally {
      if (activeLoadController.current === controller) {
        activeLoadController.current = null;
        loadInFlight.current = false;
        if (mountedRef.current && !controller.signal.aborted) setIsLoading(false);
      }
    }
  }, [applicationId, endpoint]);

  const refreshFollowUps = useCallback(() => {
    const controller = activeLoadController.current;
    controller?.abort();
    if (activeLoadController.current === controller) {
      activeLoadController.current = null;
      loadInFlight.current = false;
    }
    void loadFollowUps();
  }, [loadFollowUps]);

  const notifyFollowUpsChanged = useCallback(() => {
    selfNotificationsRef.current += 1;
    onFollowUpsChanged();
  }, [onFollowUpsChanged]);

  useEffect(() => {
    mountedRef.current = true;
    // Eager-load the canonical application overview once for this mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFollowUps();
    return () => {
      mountedRef.current = false;
      const controller = activeLoadController.current;
      controller?.abort();
      if (activeLoadController.current === controller) {
        activeLoadController.current = null;
        loadInFlight.current = false;
      }
    };
  }, [loadFollowUps]);

  useEffect(() => {
    const previousRevision = lastSeenRevisionRef.current;
    if (followUpsRevision <= previousRevision) return;

    const revisionDelta = followUpsRevision - previousRevision;
    lastSeenRevisionRef.current = followUpsRevision;
    const ignoredOwnRevisions = Math.min(revisionDelta, selfNotificationsRef.current);
    selfNotificationsRef.current -= ignoredOwnRevisions;
    if (revisionDelta > ignoredOwnRevisions) {
      refreshFollowUps();
    }
  }, [followUpsRevision, refreshFollowUps]);

  useEffect(() => {
    if (!isEditorOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
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
          ...(editing ? {} : { interview_id: null }),
          title,
          type: form.type,
          due_at_utc: dueAtUtc,
          timezone,
          notes: form.notes.trim() || null,
        }),
      });
      if (!response.ok) throw new Error("request failed");
      const saved = (await response.json()) as InterviewFollowUp;
      if (!mountedRef.current) return;
      setFollowUps((current) =>
        sortFollowUps(
          editing
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved]
        )
      );
      setHasLoaded(true);
      setIsEditorOpen(false);
      notifyFollowUpsChanged();
    } catch {
      if (mountedRef.current) {
        setFormError("Unable to save this follow-up. Please try again.");
      }
    } finally {
      saveInFlight.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  }

  async function toggleCompletion(followUp: InterviewFollowUp) {
    if (mutationInFlight.current.has(followUp.id)) return;
    mutationInFlight.current.add(followUp.id);
    setItemPending(followUp.id, true);
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
      if (!mountedRef.current) return;
      setFollowUps((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      notifyFollowUpsChanged();
    } catch {
      if (mountedRef.current) {
        setActionError("Unable to update this follow-up. Please try again.");
      }
    } finally {
      mutationInFlight.current.delete(followUp.id);
      setItemPending(followUp.id, false);
    }
  }

  async function deleteFollowUp(followUp: InterviewFollowUp) {
    if (mutationInFlight.current.has(followUp.id)) return;
    mutationInFlight.current.add(followUp.id);
    setItemPending(followUp.id, true);
    setActionError(null);
    try {
      const response = await apiFetch(`${endpoint}/${followUp.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("request failed");
      if (!mountedRef.current) return;
      setFollowUps((current) => current.filter((item) => item.id !== followUp.id));
      setPendingDelete(null);
      notifyFollowUpsChanged();
    } catch {
      if (mountedRef.current) {
        setActionError("Unable to delete this follow-up. Please try again.");
      }
    } finally {
      mutationInFlight.current.delete(followUp.id);
      setItemPending(followUp.id, false);
    }
  }

  const openFollowUps = followUps.filter((followUp) => followUp.completed_at === null);
  const completedFollowUps = followUps.filter((followUp) => followUp.completed_at !== null);

  function renderFollowUp(followUp: InterviewFollowUp) {
    const isCompleted = followUp.completed_at !== null;
    const isPending = pendingIds.has(followUp.id);
    const contextLabel = interviewContextLabel(
      followUp,
      followUp.interview_id ? interviewsById[followUp.interview_id] : undefined
    );

    return (
      <article key={followUp.id} className="border-border rounded-xl border px-4 py-3">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-foreground text-sm font-semibold">{followUp.title}</h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  followUp.interview_id
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {contextLabel}
              </span>
              <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                {typeLabel(followUp.type)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  isCompleted
                    ? "border-success-border bg-success-background text-success"
                    : "border-warning-border bg-warning-background text-warning"
                }`}
              >
                {isCompleted ? "Completed" : "Pending"}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Due {formatTimestamp(followUp.due_at_utc, followUp.timezone)} · {followUp.timezone}
            </p>
            {isCompleted ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Completed {formatTimestamp(followUp.completed_at ?? "")}
              </p>
            ) : null}
            {followUp.notes ? (
              <p className="text-foreground mt-2 whitespace-pre-wrap text-sm">{followUp.notes}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => void toggleCompletion(followUp)}
              className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
            >
              {isPending ? "Saving…" : isCompleted ? "Reopen" : "Mark complete"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => openEdit(followUp)}
              className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setPendingDelete(followUp)}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 h-10 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Follow-ups</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage application reminders and review follow-ups linked to interviews.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={isLoading || !hasLoaded}
          className="bg-primary text-primary-foreground h-10 shrink-0 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
        >
          Add follow-up
        </button>
      </div>

      {loadError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void loadFollowUps()}
            disabled={isLoading}
            className="h-10 px-2 font-semibold underline disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      ) : null}
      {actionError ? (
        <p className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border px-3 py-2 text-sm" role="alert">
          {actionError}
        </p>
      ) : null}
      {isLoading && !hasLoaded ? (
        <p className="text-muted-foreground py-6 text-sm">Loading follow-ups…</p>
      ) : null}
      {!isLoading && hasLoaded && followUps.length === 0 ? (
        <div className="border-border bg-muted/20 mt-5 rounded-xl border border-dashed px-4 py-6 text-center">
          <p className="text-foreground text-sm font-medium">No follow-ups yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Add an application reminder or create an interview-specific follow-up in an interview.
          </p>
        </div>
      ) : null}

      {openFollowUps.length > 0 ? (
        <div className="mt-5 space-y-2" aria-label="Open follow-ups">
          {openFollowUps.map(renderFollowUp)}
        </div>
      ) : null}

      {completedFollowUps.length > 0 ? (
        <div className="border-border mt-5 border-t pt-3">
          <button
            type="button"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted((current) => !current)}
            className="text-muted-foreground hover:text-foreground flex h-10 w-full items-center justify-between text-left text-sm font-semibold"
          >
            <span>Completed ({completedFollowUps.length})</span>
            <span aria-hidden="true">{showCompleted ? "▴" : "▾"}</span>
          </button>
          {showCompleted ? (
            <div className="mt-2 space-y-2 opacity-80" aria-label="Completed follow-ups">
              {completedFollowUps.map(renderFollowUp)}
            </div>
          ) : null}
        </div>
      ) : null}

      {isEditorOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
        >
          <div
            ref={dialogRef}
            onKeyDown={handleDialogKeyDown}
            className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id={dialogTitleId} className="text-foreground text-lg font-bold">
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
                <label htmlFor={`${dialogTitleId}-title`} className="text-foreground text-sm font-medium">
                  Title
                </label>
                <input
                  id={`${dialogTitleId}-title`}
                  required
                  maxLength={255}
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  className={`${controlClass} h-10`}
                />
              </div>
              <div>
                <label htmlFor={`${dialogTitleId}-type`} className="text-foreground text-sm font-medium">
                  Type
                </label>
                <select
                  id={`${dialogTitleId}-type`}
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
                  <label htmlFor={`${dialogTitleId}-due`} className="text-foreground text-sm font-medium">
                    Due date and time
                  </label>
                  <input
                    id={`${dialogTitleId}-due`}
                    type="datetime-local"
                    required
                    value={form.due_at_local}
                    onChange={(event) => setForm({ ...form, due_at_local: event.target.value })}
                    className={`${controlClass} h-10`}
                  />
                </div>
                <div>
                  <label htmlFor={`${dialogTitleId}-timezone`} className="text-foreground text-sm font-medium">
                    IANA timezone
                  </label>
                  <input
                    id={`${dialogTitleId}-timezone`}
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
                <label htmlFor={`${dialogTitleId}-notes`} className="text-foreground text-sm font-medium">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </label>
                <textarea
                  id={`${dialogTitleId}-notes`}
                  rows={4}
                  maxLength={10_000}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className={`${controlClass} py-2`}
                />
              </div>
              {formError ? (
                <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm" role="alert">
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

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete follow-up?"
        description={
          pendingDelete
            ? `Delete “${pendingDelete.title}”? This cannot be undone.`
            : "This cannot be undone."
        }
        isLoading={pendingDelete ? pendingIds.has(pendingDelete.id) : false}
        onCancel={() => {
          if (!pendingDelete || !mutationInFlight.current.has(pendingDelete.id)) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (pendingDelete) void deleteFollowUp(pendingDelete);
        }}
      />
    </section>
  );
}
