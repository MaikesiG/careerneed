"use client";

import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  apiFetch,
  InterviewPrepOutput,
  InterviewPrepSuggestion,
  PrepPriority,
  TechnicalTopic,
  GapWarning,
  isInterviewPrepSuggestion,
  isInterviewPrepSuggestionArray,
} from "@/lib/api";

type Props = {
  applicationId: string;
  interviewId: string;
};

const controlClass =
  "border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2";

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(status: InterviewPrepSuggestion["status"]): string {
  if (status === "accepted" || status === "edited") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "rejected" || status === "failed") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (status === "pending") return "border-primary/30 bg-primary/10 text-primary";
  return "border-border bg-muted text-muted-foreground";
}

function displayStatus(status: InterviewPrepSuggestion["status"]): string {
  if (status === "pending") return "Draft";
  if (status === "accepted") return "Applied";
  if (status === "edited") return "Applied (edited)";
  if (status === "rejected") return "Discarded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Readiness({ prep }: { prep: InterviewPrepOutput }) {
  const breakdown = [
    ["Technical depth", prep.readiness.breakdown.technical_depth],
    ["Role context", prep.readiness.breakdown.role_context],
    ["Behavioral examples", prep.readiness.breakdown.behavioral_examples],
    ["Logistics and preparation", prep.readiness.breakdown.logistics_and_preparation],
  ] as const;
  return (
    <div className="border-border bg-muted/20 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h6 className="text-foreground text-sm font-semibold">Preparation readiness</h6>
        <span className="text-primary text-lg font-bold">
          {prep.readiness.score === null ? "Not scored" : `${prep.readiness.score}/100`}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        This reflects preparation context for this interview, not job-match probability.
      </p>
      <p className="text-foreground mt-2 text-sm">{prep.readiness.summary}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {breakdown.map(([label, score]) => (
          <div key={label} className="flex justify-between gap-2 text-xs">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-foreground font-semibold">
              {score === null ? "—" : `${score}/100`}
            </dd>
          </div>
        ))}
      </dl>
      {prep.readiness.limitations.length ? (
        <ul className="text-muted-foreground mt-3 list-disc space-y-1 pl-5 text-xs">
          {prep.readiness.limitations.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PrepContent({ prep }: { prep: InterviewPrepOutput }) {
  return (
    <div className="mt-3 space-y-4">
      <div>
        <h6 className="text-foreground text-sm font-semibold">Summary</h6>
        <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{prep.summary}</p>
      </div>
      <Readiness prep={prep} />
      {prep.preparation_priorities.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Preparation priorities</h6>
          <div className="mt-2 space-y-2">
            {prep.preparation_priorities.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="border-border rounded-lg border px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-foreground">{item.title}</strong>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                    {item.priority}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{item.reason}</p>
                <p className="text-foreground mt-1">
                  <span className="font-medium">Action:</span> {item.recommended_action}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {prep.technical_topics.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Technical topics</h6>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {prep.technical_topics.map((item, index) => (
              <div
                key={`${item.topic}-${index}`}
                className="border-border rounded-lg border px-3 py-2 text-sm"
              >
                <strong className="text-foreground">{item.topic}</strong>
                <p className="text-muted-foreground mt-1">{item.reason}</p>
                {item.recommended_actions.length ? (
                  <ul className="text-foreground mt-1 list-disc pl-5">
                    {item.recommended_actions.map((action, actionIndex) => (
                      <li key={`${action}-${actionIndex}`}>{action}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {prep.behavioral_stories.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Behavioral stories</h6>
          <div className="mt-2 space-y-2">
            {prep.behavioral_stories.map((item, index) => (
              <div key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <p className="text-foreground font-medium">{item.story_or_evidence}</p>
                <p className="text-muted-foreground mt-1">{item.relevance}</p>
                <p className="text-foreground mt-1">
                  <span className="font-medium">Suggested angle:</span> {item.suggested_angle}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {prep.likely_questions.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Likely questions</h6>
          <ol className="mt-2 space-y-2">
            {prep.likely_questions.map((item, index) => (
              <li key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <p className="text-foreground font-medium">
                  {index + 1}. {item.question}
                </p>
                <p className="text-muted-foreground mt-1">Why: {item.reason}</p>
                <p className="text-foreground mt-1">Approach: {item.recommended_angle}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {prep.questions_to_ask.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Questions to ask</h6>
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
            {prep.questions_to_ask.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {prep.gap_warnings.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Gap warnings</h6>
          <div className="mt-2 space-y-2">
            {prep.gap_warnings.map((item, index) => (
              <div
                key={`${item.area}-${index}`}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <strong className="text-foreground">{item.area}</strong>
                <p className="text-muted-foreground mt-1">{item.reason}</p>
                <p className="text-foreground mt-1">Consider: {item.suggested_action}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {prep.limitations_or_uncertainties.length ? (
        <div>
          <h6 className="text-foreground text-sm font-semibold">Limitations and uncertainties</h6>
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
            {prep.limitations_or_uncertainties.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function InterviewPreparationSection({ applicationId, interviewId }: Props) {
  const endpoint = `/applications/${applicationId}/interviews/${interviewId}/prep`;
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<InterviewPrepSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openSuggestionIds, setOpenSuggestionIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<InterviewPrepSuggestion | null>(null);
  const [editValue, setEditValue] = useState<InterviewPrepOutput | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loadInFlightRef = useRef(false);
  const generateInFlightRef = useRef(false);
  const resolveInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);

  const loadSuggestions = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(endpoint);
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!isInterviewPrepSuggestionArray(data)) throw new Error();
      setSuggestions(data);
      setHasLoaded(true);
    } catch {
      setError("Unable to load preparation plans. Please try again.");
    } finally {
      loadInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (!isExpanded || hasLoaded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuggestions();
  }, [hasLoaded, isExpanded, loadSuggestions]);

  useEffect(() => {
    if (!editing) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && resolvingId === null) setEditing(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [editing, resolvingId]);

  async function generatePlan() {
    if (generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await apiFetch(`${endpoint}/generate`, { method: "POST" });
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!isInterviewPrepSuggestion(data)) throw new Error();
      const suggestion = data;
      setSuggestions((current) => [
        suggestion,
        ...current.filter((item) => item.id !== suggestion.id),
      ]);
      setHasLoaded(true);
    } catch {
      setGenerateError("Unable to generate a preparation plan right now. Please try again.");
    } finally {
      generateInFlightRef.current = false;
      setIsGenerating(false);
    }
  }

  async function resolveSuggestion(
    suggestion: InterviewPrepSuggestion,
    status: "accepted" | "edited",
    resolvedValue?: InterviewPrepOutput
  ) {
    if (resolveInFlightRef.current || suggestion.status !== "pending") return;
    resolveInFlightRef.current = true;
    setResolvingId(suggestion.id);
    setError(null);
    try {
      const response = await apiFetch(`${endpoint}/${suggestion.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolved_value: resolvedValue }),
      });
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!isInterviewPrepSuggestion(data)) throw new Error();
      const updated = data;
      setSuggestions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(null);
    } catch {
      const message = "Unable to save your decision. Please try again.";
      if (status === "edited") setEditError(message);
      else setError(message);
    } finally {
      resolveInFlightRef.current = false;
      setResolvingId(null);
    }
  }

  function startEditing(suggestion: InterviewPrepSuggestion) {
    setEditing(suggestion);
    const selectedValue = suggestion.resolved_value ?? suggestion.proposed_value;
    setEditValue(structuredClone(selectedValue));
    setEditError(null);
  }

  function toggleSuggestion(suggestionId: string) {
    setOpenSuggestionIds((current) => {
      const next = new Set(current);
      if (next.has(suggestionId)) next.delete(suggestionId);
      else next.add(suggestionId);
      return next;
    });
  }

  async function deleteSuggestion(suggestion: InterviewPrepSuggestion) {
    if (deleteInFlightRef.current || resolveInFlightRef.current) return;
    if (!window.confirm("Delete this preparation draft? This cannot be undone.")) return;
    deleteInFlightRef.current = true;
    setDeletingId(suggestion.id);
    setError(null);
    try {
      const response = await apiFetch(`${endpoint}/${suggestion.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      setOpenSuggestionIds((current) => {
        const next = new Set(current);
        next.delete(suggestion.id);
        return next;
      });
      if (editing?.id === suggestion.id) setEditing(null);
    } catch {
      setError("Unable to delete this preparation draft. Please try again.");
    } finally {
      deleteInFlightRef.current = false;
      setDeletingId(null);
    }
  }

  function submitEdit() {
    if (!editing || !editValue) return;
    const requiredValues = [
      editValue.summary,
      editValue.readiness.summary,
      ...editValue.preparation_priorities.flatMap((item) => [
        item.title,
        item.reason,
        item.recommended_action,
      ]),
      ...editValue.technical_topics.flatMap((item) => [
        item.topic,
        item.reason,
        ...item.recommended_actions,
      ]),
      ...editValue.gap_warnings.flatMap((item) => [item.area, item.reason, item.suggested_action]),
      ...editValue.questions_to_ask,
      ...editValue.readiness.limitations,
    ];
    if (requiredValues.some((value) => !value.trim())) {
      setEditError("Complete all visible fields or remove blank list entries before saving.");
      return;
    }
    const boundedLists = [
      editValue.questions_to_ask,
      editValue.readiness.limitations,
      ...editValue.technical_topics.map((item) => item.recommended_actions),
    ];
    if (
      boundedLists.some((items) => items.length > 20 || items.some((item) => item.length > 1000))
    ) {
      setEditError(
        "Use no more than 20 entries per list and keep each entry under 1,000 characters."
      );
      return;
    }
    void resolveSuggestion(editing, "edited", editValue);
  }

  function trapDialogFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const updatePriority = (index: number, patch: Partial<PrepPriority>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            preparation_priorities: current.preparation_priorities.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const updateTopic = (index: number, patch: Partial<TechnicalTopic>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            technical_topics: current.technical_topics.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const updateWarning = (index: number, patch: Partial<GapWarning>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            gap_warnings: current.gap_warnings.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );

  return (
    <div className="border-border/70 mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-foreground text-sm font-semibold">AI interview preparation</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Review managed AI drafts and explicitly choose which plan to apply.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <button
              type="button"
              onClick={() => void generatePlan()}
              disabled={isGenerating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate preparation plan"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition"
          >
            {isExpanded ? "Hide AI prep" : "Open AI prep"}
          </button>
        </div>
      </div>
      {isExpanded ? (
        <div className="mt-3">
          {error ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void loadSuggestions()}
                className="font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : null}
          {generateError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive mb-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>{generateError}</span>
              <button
                type="button"
                onClick={() => void generatePlan()}
                disabled={isGenerating}
                className="font-semibold underline disabled:opacity-50"
              >
                Retry generation
              </button>
            </div>
          ) : null}
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-sm">Loading preparation plans…</p>
          ) : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <div className="border-border bg-muted/20 rounded-lg border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-medium">No preparation plans yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Generate a plan when you are ready to review AI-assisted preparation.
              </p>
            </div>
          ) : null}
          <div className="space-y-3">
            {suggestions.map((suggestion) => {
              const prep = suggestion.resolved_value ?? suggestion.proposed_value;
              const isOpen = openSuggestionIds.has(suggestion.id);
              return (
                <article key={suggestion.id} className="border-border rounded-xl border p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground text-sm font-semibold">
                        AI-generated suggestion
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(suggestion.status)}`}
                      >
                        {displayStatus(suggestion.status)}
                      </span>
                      {suggestion.model_provider === "fallback" ? (
                        <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                          Fallback plan
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        Generated {formatTimestamp(suggestion.created_at)}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSuggestion(suggestion.id)}
                        aria-expanded={isOpen}
                        aria-controls={`prep-draft-${suggestion.id}`}
                        className="border-border bg-card text-foreground hover:bg-muted focus-visible:ring-primary inline-flex h-10 items-center rounded-lg border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {isOpen ? "Hide" : "View"}
                      </button>
                    </div>
                  </div>
                  {isOpen ? (
                    <div id={`prep-draft-${suggestion.id}`}>
                      <PrepContent prep={prep} />
                      <p className="text-muted-foreground mt-3 text-xs">
                        This managed plan remains separate from your preparation notes.
                      </p>
                    </div>
                  ) : null}
                  {suggestion.status === "pending" ? (
                    <div className="border-border mt-4 border-t pt-3">
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={resolvingId !== null || deletingId !== null}
                          onClick={() => void resolveSuggestion(suggestion, "accepted")}
                          className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                        >
                          {resolvingId === suggestion.id ? "Applying…" : "Apply plan"}
                        </button>
                        <button
                          type="button"
                          disabled={resolvingId !== null || deletingId !== null}
                          onClick={() => startEditing(suggestion)}
                          className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
                        >
                          Edit and apply
                        </button>
                        <button
                          type="button"
                          disabled={resolvingId !== null || deletingId !== null}
                          onClick={() => void deleteSuggestion(suggestion)}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive h-10 rounded-lg border px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                        >
                          {deletingId === suggestion.id ? "Deleting…" : "Delete draft"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-border mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                      <p className="text-muted-foreground text-xs">
                        {displayStatus(suggestion.status)}
                        {suggestion.resolved_at
                          ? ` on ${formatTimestamp(suggestion.resolved_at)}`
                          : ""}
                        . This is saved history and is no longer awaiting review.
                      </p>
                      <button
                        type="button"
                        disabled={deletingId !== null || resolvingId !== null}
                        onClick={() => void deleteSuggestion(suggestion)}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive inline-flex h-10 items-center rounded-lg border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                      >
                        {deletingId === suggestion.id ? "Deleting…" : "Delete output"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {editing && editValue ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`prep-edit-title-${interviewId}`}
        >
          <div
            ref={dialogRef}
            onKeyDown={trapDialogFocus}
            className="border-border bg-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id={`prep-edit-title-${interviewId}`}
                  className="text-foreground text-lg font-bold"
                >
                  Edit preparation plan
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Review the structured fields before confirming your version.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={resolvingId !== null}
                aria-label="Close preparation plan editor"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor={`prep-summary-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Summary
                </label>
                <textarea
                  id={`prep-summary-${interviewId}`}
                  autoFocus
                  rows={4}
                  maxLength={3000}
                  value={editValue.summary}
                  onChange={(event) => setEditValue({ ...editValue, summary: event.target.value })}
                  className={controlClass}
                />
              </div>
              <div>
                <label
                  htmlFor={`prep-readiness-summary-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Readiness summary
                </label>
                <textarea
                  id={`prep-readiness-summary-${interviewId}`}
                  rows={3}
                  maxLength={2000}
                  value={editValue.readiness.summary}
                  onChange={(event) =>
                    setEditValue({
                      ...editValue,
                      readiness: { ...editValue.readiness, summary: event.target.value },
                    })
                  }
                  className={controlClass}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Preparation readiness only—not job-match probability.
                </p>
              </div>
              <div>
                <label
                  htmlFor={`prep-readiness-limitations-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Readiness limitations
                </label>
                <textarea
                  id={`prep-readiness-limitations-${interviewId}`}
                  rows={3}
                  value={editValue.readiness.limitations.join("\n")}
                  onChange={(event) =>
                    setEditValue({
                      ...editValue,
                      readiness: {
                        ...editValue.readiness,
                        limitations: splitLines(event.target.value),
                      },
                    })
                  }
                  className={controlClass}
                />
                <p className="text-muted-foreground mt-1 text-xs">One limitation per line.</p>
              </div>
              {editValue.preparation_priorities.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Preparation priorities
                  </legend>
                  {editValue.preparation_priorities.map((item, index) => (
                    <div
                      key={index}
                      className="border-border grid gap-2 rounded-lg border p-3 sm:grid-cols-2"
                    >
                      <input
                        aria-label={`Priority ${index + 1} title`}
                        maxLength={255}
                        value={item.title}
                        onChange={(event) => updatePriority(index, { title: event.target.value })}
                        className={`${controlClass} mt-0`}
                      />
                      <select
                        aria-label={`Priority ${index + 1} level`}
                        value={item.priority}
                        onChange={(event) =>
                          updatePriority(index, {
                            priority: event.target.value as PrepPriority["priority"],
                          })
                        }
                        className={`${controlClass} mt-0 h-10`}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <textarea
                        aria-label={`Priority ${index + 1} reason`}
                        rows={2}
                        maxLength={2000}
                        value={item.reason}
                        onChange={(event) => updatePriority(index, { reason: event.target.value })}
                        className={controlClass}
                      />
                      <textarea
                        aria-label={`Priority ${index + 1} action`}
                        rows={2}
                        maxLength={2000}
                        value={item.recommended_action}
                        onChange={(event) =>
                          updatePriority(index, { recommended_action: event.target.value })
                        }
                        className={controlClass}
                      />
                    </div>
                  ))}
                </fieldset>
              ) : null}
              {editValue.technical_topics.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Technical topics
                  </legend>
                  {editValue.technical_topics.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <input
                        aria-label={`Technical topic ${index + 1}`}
                        maxLength={255}
                        value={item.topic}
                        onChange={(event) => updateTopic(index, { topic: event.target.value })}
                        className={`${controlClass} mt-0`}
                      />
                      <textarea
                        aria-label={`Technical topic ${index + 1} reason`}
                        rows={2}
                        maxLength={2000}
                        value={item.reason}
                        onChange={(event) => updateTopic(index, { reason: event.target.value })}
                        className={controlClass}
                      />
                      <textarea
                        aria-label={`Technical topic ${index + 1} actions`}
                        rows={2}
                        value={item.recommended_actions.join("\n")}
                        onChange={(event) =>
                          updateTopic(index, {
                            recommended_actions: splitLines(event.target.value),
                          })
                        }
                        className={controlClass}
                      />
                      <p className="text-muted-foreground mt-1 text-xs">One action per line.</p>
                    </div>
                  ))}
                </fieldset>
              ) : null}
              <div>
                <label
                  htmlFor={`prep-questions-to-ask-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Questions to ask
                </label>
                <textarea
                  id={`prep-questions-to-ask-${interviewId}`}
                  rows={4}
                  value={editValue.questions_to_ask.join("\n")}
                  onChange={(event) =>
                    setEditValue({ ...editValue, questions_to_ask: splitLines(event.target.value) })
                  }
                  className={controlClass}
                />
                <p className="text-muted-foreground mt-1 text-xs">One question per line.</p>
              </div>
              {editValue.gap_warnings.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">Gap warnings</legend>
                  {editValue.gap_warnings.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <input
                        aria-label={`Warning ${index + 1} area`}
                        maxLength={255}
                        value={item.area}
                        onChange={(event) => updateWarning(index, { area: event.target.value })}
                        className={`${controlClass} mt-0`}
                      />
                      <textarea
                        aria-label={`Warning ${index + 1} reason`}
                        rows={2}
                        maxLength={2000}
                        value={item.reason}
                        onChange={(event) => updateWarning(index, { reason: event.target.value })}
                        className={controlClass}
                      />
                      <textarea
                        aria-label={`Warning ${index + 1} action`}
                        rows={2}
                        maxLength={2000}
                        value={item.suggested_action}
                        onChange={(event) =>
                          updateWarning(index, { suggested_action: event.target.value })
                        }
                        className={controlClass}
                      />
                    </div>
                  ))}
                </fieldset>
              ) : null}
              {editError ? (
                <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {editError}
                </div>
              ) : null}
              <p className="text-muted-foreground text-xs">
                Applying saves this edited version as the managed plan. Your preparation notes are
                not changed.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  disabled={resolvingId !== null}
                  className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={resolvingId !== null}
                  className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {resolvingId ? "Applying…" : "Apply edited plan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
