"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  apiFetch,
  getApiErrorMessage,
  Interview,
  InterviewType,
  InterviewStatus,
  InterviewResult,
  InterviewExtraction,
} from "@/lib/api";
import { buildThankYouFollowUpPayload } from "@/lib/followUpTime";
import InterviewParticipantsSection from "./InterviewParticipantsSection";
import InterviewPreparationBriefSection from "./InterviewPreparationBriefSection";
import InterviewQuestionsSection from "./InterviewQuestionsSection";
import InterviewOutcomeAnalysisSection from "./InterviewOutcomeAnalysisSection";
import InterviewFollowUpsSection from "./InterviewFollowUpsSection";
import ConfirmDialog from "@/components/ConfirmDialog";
import InterviewDisclosureSection from "./InterviewDisclosureSection";

type ApplicationInterviewsSectionProps = {
  applicationId: string;
  companyName: string;
  jobTitle: string;
  followUpsRevision?: number;
  onFollowUpsChanged?: () => void;
};

const noopFollowUpsChanged = () => {};

const INTERVIEW_TYPE_OPTIONS: { value: InterviewType; label: string }[] = [
  { value: "recruiter", label: "Recruiter Screen" },
  { value: "technical", label: "Technical Interview" },
  { value: "coding", label: "Coding / Algorithm" },
  { value: "system_design", label: "System Design" },
  { value: "portfolio_review", label: "Portfolio Review (Design / Creative)" },
  { value: "case_study", label: "Case Study (Product / Strategy / Analyst)" },
  { value: "role_play", label: "Role Play / Pitch (Sales / BD)" },
  { value: "presentation", label: "Presentation / Pitch" },
  { value: "take_home", label: "Take-home Assignment" },
  { value: "behavioral", label: "Behavioral / Values" },
  { value: "hiring_manager", label: "Hiring Manager" },
  { value: "panel", label: "Panel / Onsite" },
  { value: "final", label: "Final Round" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: { value: InterviewStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rescheduled", label: "Rescheduled" },
];

const RESULT_OPTIONS: { value: InterviewResult; label: string }[] = [
  { value: "pending", label: "Pending Decision" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "unknown", label: "Unknown" },
];

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "Date not set";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function statusBadgeClass(status: InterviewStatus): string {
  switch (status) {
    case "scheduled":
      return "bg-primary/10 text-primary border-primary/30";
    case "completed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "cancelled":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "rescheduled":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function resultBadgeClass(result: InterviewResult): string {
  switch (result) {
    case "passed":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "failed":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "pending":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function typeLabel(type: InterviewType): string {
  const found = INTERVIEW_TYPE_OPTIONS.find((opt) => opt.value === type);
  return found?.label ?? type;
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

export default function ApplicationInterviewsSection({
  applicationId,
  companyName,
  jobTitle,
  followUpsRevision = 0,
  onFollowUpsChanged = noopFollowUpsChanged,
}: ApplicationInterviewsSectionProps) {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interviewToDelete, setInterviewToDelete] = useState<Interview | null>(null);
  const [isDeletingInterview, setIsDeletingInterview] = useState(false);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFastCaptureOpen, setIsFastCaptureOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [activeInterview, setActiveInterview] = useState<Interview | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Interview>>({
    round: 1,
    title: "Technical Interview",
    interview_type: "technical",
    scheduled_at: "",
    duration_minutes: 60,
    timezone: "EST",
    status: "scheduled",
    result: "pending",
    interviewer_name: "",
    interviewer_title: "",
    interviewer_email: "",
    meeting_url: "",
    location: "",
    notes: "",
    preparation_notes: "",
  });

  // Fast Capture State
  const [pasteText, setPasteText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<InterviewExtraction | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Complete modal state
  const [completionResult, setCompletionResult] = useState<InterviewResult>("passed");
  const [completionNotes, setCompletionNotes] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(true);
  const [isSavingCompletion, setIsSavingCompletion] = useState(false);
  const saveCompletionInFlight = useRef(false);

  const loadInterviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/applications/${applicationId}/interviews`);
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to load interviews"));
      }
      const data = (await res.json()) as Interview[];
      setInterviews(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interviews");
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    // This is the canonical initial load; later CRUD actions reuse the same callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInterviews();
  }, [loadInterviews]);

  function openCreateForm() {
    const nextRound = interviews.length > 0 ? Math.max(...interviews.map((i) => i.round)) + 1 : 1;
    setFormData({
      round: nextRound,
      title: nextRound === 1 ? "Recruiter Screen" : "Technical Interview",
      interview_type: nextRound === 1 ? "recruiter" : "technical",
      scheduled_at: "",
      duration_minutes: 60,
      timezone: "EST",
      status: "scheduled",
      result: "pending",
      interviewer_name: "",
      interviewer_title: "",
      interviewer_email: "",
      meeting_url: "",
      location: "",
      notes: "",
      preparation_notes: "",
    });
    setActiveInterview(null);
    setIsFormOpen(true);
  }

  function openEditForm(interview: Interview) {
    setActiveInterview(interview);
    setFormData({
      round: interview.round,
      title: interview.title,
      interview_type: interview.interview_type,
      scheduled_at: toLocalDatetimeInput(interview.scheduled_at),
      duration_minutes: interview.duration_minutes ?? 60,
      timezone: interview.timezone ?? "EST",
      status: interview.status,
      result: interview.result,
      interviewer_name: interview.interviewer_name ?? "",
      interviewer_title: interview.interviewer_title ?? "",
      interviewer_email: interview.interviewer_email ?? "",
      meeting_url: interview.meeting_url ?? "",
      location: interview.location ?? "",
      notes: interview.notes ?? "",
      preparation_notes: interview.preparation_notes ?? "",
    });
    setIsFormOpen(true);
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : null,
      };

      let res: Response;
      if (activeInterview) {
        res = await apiFetch(`/applications/${applicationId}/interviews/${activeInterview.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch(`/applications/${applicationId}/interviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to save interview"));
      }

      setIsFormOpen(false);
      await loadInterviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save interview");
    }
  }

  function requestDeleteInterview(interview: Interview) {
    setError(null);
    setInterviewToDelete(interview);
  }

  async function handleConfirmDeleteInterview() {
    if (!interviewToDelete) return;
    setIsDeletingInterview(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/applications/${applicationId}/interviews/${interviewToDelete.id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to delete interview"));
      }
      setInterviewToDelete(null);
      await loadInterviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete interview");
      setInterviewToDelete(null);
    } finally {
      setIsDeletingInterview(false);
    }
  }

  // Fast Capture actions
  async function handleExtract() {
    if (!pasteText.trim()) return;
    setIsExtracting(true);
    setCaptureError(null);
    try {
      const res = await apiFetch("/interviews/fast-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: pasteText,
          application_id: applicationId,
        }),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Extraction failed"));
      }
      const data = (await res.json()) as InterviewExtraction;
      setExtractedData(data);
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleConfirmExtracted() {
    if (!extractedData) return;
    try {
      const payload = {
        round: extractedData.round || interviews.length + 1,
        title: extractedData.title || "Technical Interview",
        interview_type: extractedData.interview_type || "technical",
        scheduled_at: extractedData.scheduled_at,
        duration_minutes: extractedData.duration_minutes || 60,
        timezone: extractedData.timezone || "EST",
        status: "scheduled" as InterviewStatus,
        result: "pending" as InterviewResult,
        interviewer_name: extractedData.interviewer_name || null,
        interviewer_title: extractedData.interviewer_title || null,
        interviewer_email: extractedData.interviewer_email || null,
        meeting_url: extractedData.meeting_url || null,
        location: extractedData.location || null,
        notes: extractedData.notes || null,
        preparation_notes: extractedData.notes ? `Extracted notes: ${extractedData.notes}` : null,
      };

      const res = await apiFetch(`/applications/${applicationId}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to schedule interview"));
      }

      setIsFastCaptureOpen(false);
      setExtractedData(null);
      setPasteText("");
      await loadInterviews();
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Failed to schedule interview");
    }
  }

  function openCompleteModal(interview: Interview) {
    setActiveInterview(interview);
    setCompletionResult("passed");
    setCompletionNotes(interview.notes ?? "");
    setScheduleFollowUp(true);
    setIsCompleteModalOpen(true);
  }

  async function handleSaveCompletion() {
    if (!activeInterview || saveCompletionInFlight.current || isSavingCompletion) return;
    saveCompletionInFlight.current = true;
    setIsSavingCompletion(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/applications/${applicationId}/interviews/${activeInterview.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            result: completionResult,
            notes: completionNotes,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to update interview"));
      }

      let followUpError: string | null = null;
      if (scheduleFollowUp) {
        try {
          const followUpPayload = buildThankYouFollowUpPayload(activeInterview);
          const followUpRes = await apiFetch(
            `/applications/${applicationId}/follow-ups`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(followUpPayload),
            }
          );

          if (!followUpRes.ok) {
            followUpError =
              "Interview marked completed, but unable to schedule the thank-you follow-up. You can add it manually in the follow-ups section.";
          }
        } catch {
          followUpError =
            "Interview marked completed, but unable to schedule the thank-you follow-up. You can add it manually in the follow-ups section.";
        }
      }

      setIsCompleteModalOpen(false);
      await loadInterviews();

      if (followUpError) {
        setError(followUpError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete interview");
    } finally {
      saveCompletionInFlight.current = false;
      setIsSavingCompletion(false);
    }
  }

  return (
    <section className="border-border bg-card mt-6 rounded-2xl border p-5 shadow-sm sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Interviews</h2>
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
              {interviews.length}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Schedule rounds, manage interviewers, track prep notes, and capture details
            automatically.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPasteText("");
              setExtractedData(null);
              setCaptureError(null);
              setIsFastCaptureOpen(true);
            }}
            className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition"
          >
            <span className="text-base leading-none">⚡</span>
            <span>Paste & Extract</span>
          </button>

          <button
            type="button"
            onClick={openCreateForm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition"
          >
            <span>+ Add Interview</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border p-3 text-sm">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-muted-foreground py-8 text-center text-sm">Loading interviews…</div>
      ) : interviews.length === 0 ? (
        <div className="border-border bg-muted/30 mt-5 rounded-xl border border-dashed p-8 text-center">
          <p className="text-foreground font-medium">No interviews recorded yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Log your scheduled rounds manually or paste recruiter email invites to auto-extract.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsFastCaptureOpen(true)}
              className="border-border bg-card hover:bg-muted text-foreground rounded-lg border px-3 py-1.5 text-xs font-medium transition"
            >
              ⚡ Fast Capture from Email
            </button>
            <button
              type="button"
              onClick={openCreateForm}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-xs font-medium transition"
            >
              + Manual Schedule
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {interviews.map((interview) => {
            const isPast = interview.scheduled_at && new Date(interview.scheduled_at) < new Date();
            const isOverdue = isPast && interview.status === "scheduled";

            return (
              <div
                key={interview.id}
                className={`border-border bg-card hover:border-primary/40 rounded-xl border p-4 shadow-xs transition ${
                  isOverdue ? "border-amber-500/40 bg-amber-500/[0.02]" : ""
                }`}
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border-border bg-muted text-foreground rounded-md border px-2 py-0.5 text-xs font-bold">
                        Round {interview.round}
                      </span>
                      <h3 className="text-foreground text-base font-semibold">{interview.title}</h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(
                          interview.status
                        )}`}
                      >
                        {interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                      </span>
                      {interview.result !== "pending" && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${resultBadgeClass(
                            interview.result
                          )}`}
                        >
                          {interview.result === "passed" ? "✓ Passed" : "✗ Failed"}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          Needs update
                        </span>
                      )}
                    </div>

                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm">
                      <div className="flex items-center gap-1 font-medium">
                        <span>🗓️</span>
                        <span>{formatDateTime(interview.scheduled_at)}</span>
                        {interview.timezone && <span>({interview.timezone})</span>}
                      </div>

                      <div className="flex items-center gap-1">
                        <span>⏱️</span>
                        <span>{interview.duration_minutes ?? 60} min</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <span>🏷️</span>
                        <span>{typeLabel(interview.interview_type)}</span>
                      </div>
                    </div>

                    {/* Interviewer details */}
                    {interview.interviewer_name ? (
                      <div className="border-border/60 bg-muted/20 mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Interviewer:</span>
                        <span className="text-foreground font-semibold">
                          {interview.interviewer_name}
                        </span>
                        {interview.interviewer_title ? (
                          <span className="text-muted-foreground">
                            · {interview.interviewer_title}
                          </span>
                        ) : null}
                        {interview.interviewer_email ? (
                          <a
                            href={`mailto:${interview.interviewer_email}`}
                            className="text-primary hover:underline"
                          >
                            ({interview.interviewer_email})
                          </a>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Preparation / Notes snippets */}
                    {interview.preparation_notes ? (
                      <div className="mt-2 text-xs sm:text-sm">
                        <span className="text-foreground font-medium">Prep notes: </span>
                        <span className="text-muted-foreground">{interview.preparation_notes}</span>
                      </div>
                    ) : null}

                    {interview.notes ? (
                      <div className="mt-2 text-xs sm:text-sm">
                        <span className="text-foreground font-medium">Review / Notes: </span>
                        <span className="text-muted-foreground">{interview.notes}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Actions right side */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {interview.meeting_url ? (
                      <a
                        href={interview.meeting_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition"
                      >
                        <span>Join Meeting</span>
                        <span>↗</span>
                      </a>
                    ) : null}

                    {interview.status === "scheduled" && (
                      <button
                        type="button"
                        onClick={() => openCompleteModal(interview)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20 dark:text-emerald-400"
                      >
                        ✓ Mark Completed
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditForm(interview)}
                      className="border-border bg-card hover:bg-muted text-foreground rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => requestDeleteInterview(interview)}
                      className="hover:text-destructive text-muted-foreground p-1 text-xs transition"
                      title="Delete interview"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <InterviewDisclosureSection
                    id={`interview-${interview.id}-preparation`}
                    title="Preparation"
                    defaultOpen={true}
                  >
                    {interview.preparation_notes ? (
                      <div className="border-border bg-muted/20 my-2 rounded-lg border p-3 text-xs sm:text-sm">
                        <span className="text-foreground font-medium">Prep notes: </span>
                        <span className="text-muted-foreground whitespace-pre-wrap">
                          {interview.preparation_notes}
                        </span>
                      </div>
                    ) : null}
                    <InterviewPreparationBriefSection
                      applicationId={applicationId}
                      interviewId={interview.id}
                    />
                  </InterviewDisclosureSection>

                  <InterviewQuestionsSection
                    applicationId={applicationId}
                    interviewId={interview.id}
                  />
                  <InterviewOutcomeAnalysisSection
                    applicationId={applicationId}
                    interviewId={interview.id}
                  />

                  <InterviewParticipantsSection
                    applicationId={applicationId}
                    interviewId={interview.id}
                  />

                  <InterviewFollowUpsSection
                    applicationId={applicationId}
                    interviewId={interview.id}
                    followUpsRevision={followUpsRevision}
                    onFollowUpsChanged={onFollowUpsChanged}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add / Edit Modal */}
      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="border-border bg-card max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <h3 className="text-lg font-bold">
              {activeInterview ? `Edit Round ${activeInterview.round}` : "Schedule New Interview"}
            </h3>
            <p className="text-muted-foreground text-xs">
              {companyName} — {jobTitle}
            </p>

            <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-foreground block text-xs font-medium">Round Number</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.round ?? 1}
                    onChange={(e) =>
                      setFormData({ ...formData, round: parseInt(e.target.value) || 1 })
                    }
                    className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-foreground block text-xs font-medium">
                    Interview Type
                  </label>
                  <select
                    value={formData.interview_type ?? "technical"}
                    onChange={(e) =>
                      setFormData({ ...formData, interview_type: e.target.value as InterviewType })
                    }
                    className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  >
                    {INTERVIEW_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">Title *</label>
                <input
                  type="text"
                  value={formData.title ?? ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Technical Coding Round"
                  className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-foreground block text-xs font-medium">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduled_at ?? ""}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-foreground block text-xs font-medium">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      step={15}
                      min={15}
                      max={480}
                      value={formData.duration_minutes ?? 60}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          duration_minutes: parseInt(e.target.value) || 60,
                        })
                      }
                      className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-foreground block text-xs font-medium">Timezone</label>
                    <input
                      type="text"
                      value={formData.timezone ?? "EST"}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-foreground block text-xs font-medium">Status</label>
                  <select
                    value={formData.status ?? "scheduled"}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as InterviewStatus })
                    }
                    className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-foreground block text-xs font-medium">Result</label>
                  <select
                    value={formData.result ?? "pending"}
                    onChange={(e) =>
                      setFormData({ ...formData, result: e.target.value as InterviewResult })
                    }
                    className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  >
                    {RESULT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">
                  Meeting URL (Zoom / Google Meet)
                </label>
                <input
                  type="url"
                  value={formData.meeting_url ?? ""}
                  onChange={(e) => setFormData({ ...formData, meeting_url: e.target.value })}
                  placeholder="https://zoom.us/j/..."
                  className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {/* Interviewer fields */}
              <div className="border-border/60 bg-muted/10 rounded-xl border p-3">
                <p className="text-foreground text-xs font-semibold">Interviewer Information</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formData.interviewer_name ?? ""}
                    onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
                    placeholder="Name (e.g. John Smith)"
                    className="border-border bg-card focus:border-primary rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                  <input
                    type="text"
                    value={formData.interviewer_title ?? ""}
                    onChange={(e) =>
                      setFormData({ ...formData, interviewer_title: e.target.value })
                    }
                    placeholder="Title (e.g. Staff Engineer)"
                    className="border-border bg-card focus:border-primary rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <input
                  type="email"
                  value={formData.interviewer_email ?? ""}
                  onChange={(e) => setFormData({ ...formData, interviewer_email: e.target.value })}
                  placeholder="Email (optional)"
                  className="border-border bg-card focus:border-primary mt-2 w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">
                  Preparation Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.preparation_notes ?? ""}
                  onChange={(e) => setFormData({ ...formData, preparation_notes: e.target.value })}
                  placeholder="Key topics to review, questions to prepare, system design principles..."
                  className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">
                  Review & Outcome Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes ?? ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Questions asked, answers given, reflection notes..."
                  className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="border-border bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold transition"
                >
                  {activeInterview ? "Save Changes" : "Create Interview"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Fast Capture Modal */}
      {isFastCaptureOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="border-border bg-card max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h3 className="text-lg font-bold">Fast Capture / Paste & Extract</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFastCaptureOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Paste your recruiter invitation, calendar email, or message. Our AI pipeline extracts
              structured round info for your confirmation.
            </p>

            {!extractedData ? (
              <div className="mt-4 space-y-4">
                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`Hi candidate,\n\nWe would like to invite you to a Technical Interview on Thursday, September 24 at 2:00 PM EST (60 min).\nYou'll meet with John Smith, Senior Software Engineer.\n\nZoom: https://zoom.us/j/1234567890`}
                  className="border-border bg-muted/20 focus:border-primary w-full rounded-xl border p-3 font-mono text-xs focus:outline-none"
                />

                {captureError ? (
                  <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs">
                    {captureError}
                  </div>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFastCaptureOpen(false)}
                    className="border-border bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={!pasteText.trim() || isExtracting}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <span className="animate-spin text-sm">⏳</span>
                        <span>Extracting details…</span>
                      </>
                    ) : (
                      <span>Extract Details →</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {/* Extracted preview card */}
                <div className="border-primary/40 bg-primary/5 rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-primary text-xs font-bold tracking-wider uppercase">
                      ✓ Interview Detected
                    </span>
                    <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                      Round {extractedData.round}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground font-medium">Company</dt>
                      <dd className="text-foreground font-semibold">{companyName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Role</dt>
                      <dd className="text-foreground font-semibold">{jobTitle}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Title</dt>
                      <dd className="text-foreground font-semibold">{extractedData.title}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Interview Type</dt>
                      <dd className="text-foreground">{typeLabel(extractedData.interview_type)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Date & Time</dt>
                      <dd className="text-foreground font-semibold">
                        {formatDateTime(extractedData.scheduled_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Duration & Timezone</dt>
                      <dd className="text-foreground">
                        {extractedData.duration_minutes ?? 60} min{" "}
                        {extractedData.timezone ? `(${extractedData.timezone})` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Interviewer</dt>
                      <dd className="text-foreground font-semibold">
                        {extractedData.interviewer_name ?? "Not specified"}
                        {extractedData.interviewer_title
                          ? ` (${extractedData.interviewer_title})`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground font-medium">Meeting URL</dt>
                      <dd className="text-foreground truncate">
                        {extractedData.meeting_url ?? "None detected"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setExtractedData(null)}
                    className="border-border bg-card hover:bg-muted rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                  >
                    ← Edit Raw Text
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFastCaptureOpen(false)}
                      className="border-border bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmExtracted}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition"
                    >
                      Confirm & Schedule Round {extractedData.round}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Mark Completed Modal */}
      {isCompleteModalOpen && activeInterview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="border-border bg-card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border p-6 shadow-xl">
            <h3 className="text-lg font-bold">Mark Interview Completed</h3>
            <p className="text-muted-foreground text-xs">
              {activeInterview.title} (Round {activeInterview.round}) · {companyName}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-foreground block text-xs font-medium">
                  Outcome / Result
                </label>
                <select
                  value={completionResult}
                  onChange={(e) => setCompletionResult(e.target.value as InterviewResult)}
                  className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="passed">✓ Passed / Advance to Next Round</option>
                  <option value="pending">○ Pending Decision / Waiting for feedback</option>
                  <option value="failed">✗ Failed / Did not advance</option>
                </select>
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">
                  Debrief & Review Notes
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="What questions were asked? How did it go? What needs improvement?"
                  className="border-border bg-muted/30 focus:border-primary mt-1 w-full rounded-lg border px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="border-border/60 bg-muted/20 rounded-xl border p-3">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={scheduleFollowUp}
                    onChange={(e) => setScheduleFollowUp(e.target.checked)}
                    disabled={isSavingCompletion}
                    className="text-primary focus:ring-primary mt-0.5 rounded border-gray-300"
                  />
                  <div>
                    <span className="text-foreground text-xs font-semibold">
                      Schedule Follow-up: Send thank-you note
                    </span>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Creates a follow-up reminder for tomorrow at 10:00 AM linked to this interview.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="border-border bg-card hover:bg-muted rounded-lg border px-4 py-2 text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompletion}
                  disabled={isSavingCompletion}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSavingCompletion ? "Saving…" : "Save & Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(interviewToDelete)}
        title="Delete Interview Round"
        description={
          interviewToDelete
            ? `Are you sure you want to delete "${interviewToDelete.title}" (Round ${interviewToDelete.round})? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete Interview"
        isLoading={isDeletingInterview}
        onConfirm={handleConfirmDeleteInterview}
        onCancel={() => setInterviewToDelete(null)}
      />
    </section>
  );
}
