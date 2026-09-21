"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, FollowUpType, InterviewFollowUp } from "@/lib/api";
import {
  browserTimezone,
  formatTimestamp,
  serializeZonedDatetime,
  toDatetimeInput,
} from "@/lib/followUpTime";
import ConfirmDialog from "@/components/ConfirmDialog";

type Props = {
  applicationId: string;
  interviewId: string;
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
    type: "thank_you",
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

export default function InterviewFollowUpsSection({
  applicationId,
  interviewId,
  followUpsRevision,
  onFollowUpsChanged,
}: Props) {
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
  const [pendingDelete, setPendingDelete] = useState<InterviewFollowUp | null>(null);
  const loadInFlight = useRef(false);
  const saveInFlight = useRef(false);
  const updateInFlight = useRef(false);
  const deleteInFlight = useRef(false);
  const mountedRef = useRef(true);
  const activeLoadController = useRef<AbortController | null>(null);
  const lastSeenRevisionRef = useRef(followUpsRevision);
  const selfNotificationsRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const endpoint = `/applications/${applicationId}/follow-ups`;

  const loadFollowUps = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    const controller = new AbortController();
    activeLoadController.current = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch(
        `${endpoint}?interview_id=${encodeURIComponent(interviewId)}`,
        { cache: "no-store", signal: controller.signal }
      );
      if (!response.ok) throw new Error("request failed");
      const loadedFollowUps = (await response.json()) as InterviewFollowUp[];
      if (!mountedRef.current || controller.signal.aborted) return;
      setFollowUps(loadedFollowUps);
      setHasLoaded(true);
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
  }, [endpoint, interviewId]);

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
    return () => {
      mountedRef.current = false;
      const controller = activeLoadController.current;
      controller?.abort();
      if (activeLoadController.current === controller) {
        activeLoadController.current = null;
        loadInFlight.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!isExpanded || hasLoaded || loadError) return;
    // Lazy-load once for this mounted interview card.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFollowUps();
  }, [hasLoaded, isExpanded, loadError, loadFollowUps]);

  useEffect(() => {
    const previousRevision = lastSeenRevisionRef.current;
    if (followUpsRevision <= previousRevision) return;

    const revisionDelta = followUpsRevision - previousRevision;
    lastSeenRevisionRef.current = followUpsRevision;
    const ignoredOwnRevisions = Math.min(revisionDelta, selfNotificationsRef.current);
    selfNotificationsRef.current -= ignoredOwnRevisions;
    if (revisionDelta > ignoredOwnRevisions && (hasLoaded || isExpanded)) {
      refreshFollowUps();
    }
  }, [followUpsRevision, hasLoaded, isExpanded, refreshFollowUps]);

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
      if (!mountedRef.current) return;
      setFollowUps((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notifyFollowUpsChanged();
    } catch {
      if (mountedRef.current) {
        setActionError("Unable to update this follow-up. Please try again.");
      }
    } finally {
      updateInFlight.current = false;
      if (mountedRef.current) setUpdatingId(null);
    }
  }

  async function deleteFollowUp(followUp: InterviewFollowUp) {
    if (deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeletingId(followUp.id);
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
      deleteInFlight.current = false;
      if (mountedRef.current) setDeletingId(null);
    }
  }

  return (
    <div className="border-border mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-foreground text-sm font-semibold">
            Follow-ups{hasLoaded ? ` · ${followUps.length}` : ""}
          </h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Manage reminders related to this interview round.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-controls={`follow-ups-${interviewId}`}
          aria-label={`${isExpanded ? "Hide" : "Show"} Follow-ups`}
          className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition"
        >
          {isExpanded ? "Hide" : "Show"}
          <span aria-hidden="true" className="ml-2">
            {isExpanded ? "▴" : "▾"}
          </span>
        </button>
      </div>

      {isExpanded ? (
        <div id={`follow-ups-${interviewId}`} className="pt-2">
          <div className="mb-3 flex justify-end">
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
              <button
                type="button"
                onClick={() => void loadFollowUps()}
                className="font-semibold underline"
              >
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
                        <p className="text-foreground mt-2 text-sm whitespace-pre-wrap">
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
                        onClick={() => setPendingDelete(followUp)}
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
                <h3
                  id={`follow-up-editor-title-${interviewId}`}
                  className="text-foreground text-lg font-bold"
                >
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
                <label
                  htmlFor={`follow-up-title-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
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
                <label
                  htmlFor={`follow-up-type-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Type
                </label>
                <select
                  id={`follow-up-type-${interviewId}`}
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value as FollowUpType })
                  }
                  className={`${controlClass} h-10`}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={`follow-up-due-${interviewId}`}
                    className="text-foreground text-sm font-medium"
                  >
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
                  <label
                    htmlFor={`follow-up-timezone-${interviewId}`}
                    className="text-foreground text-sm font-medium"
                  >
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
                <label
                  htmlFor={`follow-up-notes-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
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

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete follow-up?"
        description={
          pendingDelete
            ? `Delete “${pendingDelete.title}”? This cannot be undone.`
            : "This cannot be undone."
        }
        isLoading={deletingId !== null}
        onCancel={() => {
          if (!deleteInFlight.current) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) void deleteFollowUp(pendingDelete);
        }}
      />
    </div>
  );
}
