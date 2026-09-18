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
  GroundedObservation,
  InterviewOutcomeAnalysisOutput,
  InterviewOutcomeSuggestion,
  OutcomeGrowthArea,
  OutcomeInsight,
  OutcomeRecommendedAction,
  OutcomeRecurringTopic,
  OutcomeSourceReference,
} from "@/lib/api";

type Props = { applicationId: string; interviewId: string };

const controlClass =
  "border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2";

const SOURCE_LABELS: Record<OutcomeSourceReference, string> = {
  interview_notes: "Interview notes",
  question: "Recorded question",
  answer_notes: "Answer notes",
  reflection: "Reflection",
  interview_result: "Recorded interview result",
};

const OUTCOME_STATUSES = new Set<string>([
  "pending",
  "accepted",
  "rejected",
  "edited",
  "expired",
  "failed",
  "superseded",
]);
const TIME_HORIZONS = new Set<string>(["before_next_interview", "this_week", "ongoing"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isConfidence(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && value >= 0 && value <= 1);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isSourceReference(value: unknown): value is OutcomeSourceReference {
  return typeof value === "string" && value in SOURCE_LABELS;
}

function isTimeHorizon(value: unknown): value is OutcomeRecommendedAction["time_horizon"] {
  return typeof value === "string" && TIME_HORIZONS.has(value);
}

function isOutcomeOutput(value: unknown): value is InterviewOutcomeAnalysisOutput {
  if (!isRecord(value)) return false;
  const observationsValid =
    Array.isArray(value.grounded_observations) &&
    value.grounded_observations.every(
      (item) =>
        isRecord(item) &&
        typeof item.observation === "string" &&
        isSourceReference(item.source_reference) &&
        typeof item.evidence_summary === "string" &&
        isConfidence(item.confidence)
    );
  const strengthsValid =
    Array.isArray(value.possible_strengths) &&
    value.possible_strengths.every(
      (item) =>
        isRecord(item) &&
        typeof item.title === "string" &&
        typeof item.explanation === "string" &&
        typeof item.evidence_summary === "string" &&
        isConfidence(item.confidence)
    );
  const growthValid =
    Array.isArray(value.possible_growth_areas) &&
    value.possible_growth_areas.every(
      (item) =>
        isRecord(item) &&
        typeof item.area === "string" &&
        typeof item.rationale === "string" &&
        typeof item.suggested_action === "string" &&
        isConfidence(item.confidence)
    );
  const topicsValid =
    Array.isArray(value.recurring_topics) &&
    value.recurring_topics.every(
      (item) =>
        isRecord(item) &&
        typeof item.topic === "string" &&
        typeof item.occurrence_context === "string" &&
        isConfidence(item.confidence)
    );
  const actionsValid =
    Array.isArray(value.recommended_actions) &&
    value.recommended_actions.every(
      (item) =>
        isRecord(item) &&
        typeof item.action === "string" &&
        isTimeHorizon(item.time_horizon) &&
        typeof item.rationale === "string" &&
        isStringArray(item.related_topics)
    );
  const scope = value.analysis_scope;
  const scopeValid =
    isRecord(scope) &&
    typeof scope.interviews_considered === "number" &&
    typeof scope.questions_considered === "number" &&
    typeof scope.notes_available === "boolean" &&
    typeof scope.result_recorded === "boolean" &&
    isStringArray(scope.data_limitations);
  return (
    observationsValid &&
    strengthsValid &&
    growthValid &&
    topicsValid &&
    actionsValid &&
    isStringArray(value.suggested_follow_up_points) &&
    isStringArray(value.uncertainty_notes) &&
    isStringArray(value.limitations) &&
    scopeValid
  );
}

function isOutcomeSuggestion(value: unknown): value is InterviewOutcomeSuggestion {
  if (!isRecord(value)) return false;
  const status = value.status;
  return (
    typeof value.id === "string" &&
    typeof value.interview_id === "string" &&
    typeof value.entity_type === "string" &&
    (value.entity_id === null || typeof value.entity_id === "string") &&
    value.suggestion_type === "interview_outcome_analysis" &&
    isOutcomeOutput(value.proposed_value) &&
    (value.resolved_value === null || isOutcomeOutput(value.resolved_value)) &&
    isNullableNumber(value.confidence) &&
    (value.rationale === null || typeof value.rationale === "string") &&
    typeof value.model_provider === "string" &&
    typeof value.model_version === "string" &&
    typeof value.prompt_version === "string" &&
    typeof value.output_schema_version === "string" &&
    typeof value.input_snapshot_hash === "string" &&
    typeof status === "string" &&
    OUTCOME_STATUSES.has(status) &&
    (value.resolved_at === null || typeof value.resolved_at === "string") &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Timestamp unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatConfidence(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}% confidence`;
}

function displayStatus(status: InterviewOutcomeSuggestion["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: InterviewOutcomeSuggestion["status"]): string {
  if (status === "accepted" || status === "edited") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (status === "rejected" || status === "failed") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (status === "pending") return "border-primary/30 bg-primary/10 text-primary";
  return "border-border bg-muted text-muted-foreground";
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function Confidence({ value }: { value: number | null }) {
  const label = formatConfidence(value);
  return label ? <span className="text-muted-foreground text-xs">{label}</span> : null;
}

function OutcomeContent({ output }: { output: InterviewOutcomeAnalysisOutput }) {
  return (
    <div className="mt-4 space-y-4">
      {output.grounded_observations.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Grounded observations</h6>
          <div className="mt-2 space-y-2">
            {output.grounded_observations.map((item, index) => (
              <div key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-foreground">{item.observation}</strong>
                  <Confidence value={item.confidence} />
                </div>
                <p className="text-muted-foreground mt-1">{item.evidence_summary}</p>
                <p className="text-primary mt-1 text-xs font-medium">
                  Source: {SOURCE_LABELS[item.source_reference]}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.possible_strengths.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Possible strengths</h6>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {output.possible_strengths.map((item, index) => (
              <div key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-foreground">{item.title}</strong>
                  <Confidence value={item.confidence} />
                </div>
                <p className="text-muted-foreground mt-1">{item.explanation}</p>
                <p className="text-foreground mt-1 text-xs">Evidence: {item.evidence_summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.possible_growth_areas.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Possible growth areas</h6>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {output.possible_growth_areas.map((item, index) => (
              <div key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-foreground">{item.area}</strong>
                  <Confidence value={item.confidence} />
                </div>
                <p className="text-muted-foreground mt-1">{item.rationale}</p>
                <p className="text-foreground mt-1">Consider: {item.suggested_action}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.recurring_topics.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Recurring topics</h6>
          <div className="mt-2 space-y-2">
            {output.recurring_topics.map((item, index) => (
              <div key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-foreground">{item.topic}</strong>
                  <Confidence value={item.confidence} />
                </div>
                <p className="text-muted-foreground mt-1">Scope: {item.occurrence_context}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.recommended_actions.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Recommended actions</h6>
          <div className="mt-2 space-y-2">
            {output.recommended_actions.map((item, index) => (
              <div key={index} className="border-border rounded-lg border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-foreground">{item.action}</strong>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                    {item.time_horizon.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{item.rationale}</p>
                {item.related_topics.length ? (
                  <p className="text-foreground mt-1 text-xs">
                    Related topics: {item.related_topics.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {output.suggested_follow_up_points.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Suggested follow-up points</h6>
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
            {output.suggested_follow_up_points.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {output.uncertainty_notes.length ? (
        <section>
          <h6 className="text-foreground text-sm font-semibold">Uncertainties</h6>
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
            {output.uncertainty_notes.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-border bg-muted/20 rounded-lg border p-3">
        <h6 className="text-foreground text-sm font-semibold">Analysis scope</h6>
        <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Interviews considered</dt>
            <dd className="text-foreground font-semibold">
              {output.analysis_scope.interviews_considered}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Questions considered</dt>
            <dd className="text-foreground font-semibold">
              {output.analysis_scope.questions_considered}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Notes available</dt>
            <dd className="text-foreground font-semibold">
              {output.analysis_scope.notes_available ? "Yes" : "No"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Result recorded</dt>
            <dd className="text-foreground font-semibold">
              {output.analysis_scope.result_recorded ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
        {output.analysis_scope.data_limitations.length ? (
          <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-xs">
            {output.analysis_scope.data_limitations.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h6 className="text-foreground text-sm font-semibold">Limitations</h6>
        <ul className="text-muted-foreground mt-2 list-disc space-y-1 pl-5 text-sm">
          {output.limitations.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function InterviewOutcomeAnalysisSection({ applicationId, interviewId }: Props) {
  const endpoint = `/applications/${applicationId}/interviews/${interviewId}/outcome-analysis`;
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<InterviewOutcomeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<InterviewOutcomeSuggestion | null>(null);
  const [editValue, setEditValue] = useState<InterviewOutcomeAnalysisOutput | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const loadInFlightRef = useRef(false);
  const generateInFlightRef = useRef(false);
  const resolveInFlightRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sectionToggleRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const loadSuggestions = useCallback(async () => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch(endpoint);
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(isOutcomeSuggestion)) throw new Error();
      setSuggestions(data);
      setHasLoaded(true);
    } catch {
      setError("Unable to load outcome analyses. Please try again.");
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

  useEffect(() => {
    if (!editing) return;
    const fallbackFocusTarget = sectionToggleRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      const initialTarget = dialogRef.current?.querySelector<HTMLElement>(
        "textarea, input, select, button:not([disabled])"
      );
      initialTarget?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      const returnTarget = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
        else fallbackFocusTarget?.focus();
      });
    };
  }, [editing]);

  async function generateAnalysis() {
    if (generateInFlightRef.current) return;
    generateInFlightRef.current = true;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const response = await apiFetch(`${endpoint}/generate`, { method: "POST" });
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!isOutcomeSuggestion(data)) throw new Error();
      const suggestion = data;
      setSuggestions((current) => [
        suggestion,
        ...current.filter((item) => item.id !== suggestion.id),
      ]);
      setHasLoaded(true);
    } catch {
      setGenerateError("Unable to generate an outcome analysis right now. Please try again.");
    } finally {
      generateInFlightRef.current = false;
      setIsGenerating(false);
    }
  }

  async function resolveSuggestion(
    suggestion: InterviewOutcomeSuggestion,
    status: "accepted" | "rejected" | "edited",
    resolvedValue?: InterviewOutcomeAnalysisOutput
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
      if (!isOutcomeSuggestion(data)) throw new Error();
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

  function startEditing(suggestion: InterviewOutcomeSuggestion) {
    const selectedValue = suggestion.resolved_value ?? suggestion.proposed_value;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(suggestion);
    setEditValue(structuredClone(selectedValue));
    setEditError(null);
  }

  function submitEdit() {
    if (!editing || !editValue) return;
    const required = [
      ...editValue.grounded_observations.flatMap((item) => [
        item.observation,
        item.evidence_summary,
      ]),
      ...editValue.possible_strengths.flatMap((item) => [
        item.title,
        item.explanation,
        item.evidence_summary,
      ]),
      ...editValue.possible_growth_areas.flatMap((item) => [
        item.area,
        item.rationale,
        item.suggested_action,
      ]),
      ...editValue.recurring_topics.flatMap((item) => [item.topic, item.occurrence_context]),
      ...editValue.recommended_actions.flatMap((item) => [
        item.action,
        item.rationale,
        ...item.related_topics,
      ]),
      ...editValue.suggested_follow_up_points,
      ...editValue.uncertainty_notes,
      ...editValue.limitations,
      ...editValue.analysis_scope.data_limitations,
    ];
    if (!editValue.limitations.length || required.some((item) => !item.trim())) {
      setEditError("Complete all visible fields or remove blank list entries before saving.");
      return;
    }
    if (required.some((item) => item.length > 1000)) {
      setEditError("Keep each edited entry under 1,000 characters.");
      return;
    }
    if (
      editValue.suggested_follow_up_points.length > 20 ||
      editValue.uncertainty_notes.length > 20 ||
      editValue.limitations.length > 20 ||
      editValue.recommended_actions.some(
        (item) =>
          item.related_topics.length > 10 || item.related_topics.some((topic) => topic.length > 200)
      )
    ) {
      setEditError("Use no more than the allowed number of concise list entries.");
      return;
    }
    const normalizedLimitations = editValue.limitations.join(" ").toLowerCase();
    if (
      !normalizedLimitations.includes("based on user-recorded information") ||
      !normalizedLimitations.includes("does not determine employer decision-making")
    ) {
      setEditError(
        "Keep the required user-recorded information and employer decision-making limitation."
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

  const updateObservation = (index: number, patch: Partial<GroundedObservation>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            grounded_observations: current.grounded_observations.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const updateStrength = (index: number, patch: Partial<OutcomeInsight>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            possible_strengths: current.possible_strengths.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const updateGrowth = (index: number, patch: Partial<OutcomeGrowthArea>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            possible_growth_areas: current.possible_growth_areas.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const updateTopic = (index: number, patch: Partial<OutcomeRecurringTopic>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            recurring_topics: current.recurring_topics.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );
  const updateAction = (index: number, patch: Partial<OutcomeRecommendedAction>) =>
    setEditValue((current) =>
      current
        ? {
            ...current,
            recommended_actions: current.recommended_actions.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ...patch } : item
            ),
          }
        : current
    );

  return (
    <div className="border-border/70 mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-foreground text-sm font-semibold">Post-interview analysis</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Based on your recorded interview information.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <button
              type="button"
              onClick={() => void generateAnalysis()}
              disabled={isGenerating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? "Generating…" : "Generate outcome analysis"}
            </button>
          ) : null}
          <button
            ref={sectionToggleRef}
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            className="border-border bg-card text-foreground hover:bg-muted inline-flex h-10 items-center rounded-lg border px-3 text-sm font-medium transition"
          >
            {isExpanded ? "Hide analysis" : "Open analysis"}
          </button>
        </div>
      </div>
      {isExpanded ? (
        <div className="mt-3">
          <p className="border-border bg-muted/20 text-muted-foreground mb-3 rounded-lg border px-3 py-2 text-xs">
            This does not determine the employer’s decision-making or predict hiring outcomes.
          </p>
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
                onClick={() => void generateAnalysis()}
                disabled={isGenerating}
                className="font-semibold underline disabled:opacity-50"
              >
                Retry generation
              </button>
            </div>
          ) : null}
          {isLoading ? (
            <p className="text-muted-foreground py-4 text-sm">Loading outcome analyses…</p>
          ) : null}
          {!isLoading && !error && suggestions.length === 0 ? (
            <div className="border-border bg-muted/20 rounded-lg border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-medium">No outcome analyses yet</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Generate an analysis after recording interview notes, questions, or reflections.
              </p>
            </div>
          ) : null}
          <div className="space-y-3">
            {suggestions.map((suggestion) => {
              const output = suggestion.resolved_value ?? suggestion.proposed_value;
              return (
                <article key={suggestion.id} className="border-border rounded-xl border p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground text-sm font-semibold">
                        AI-generated analysis
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(suggestion.status)}`}
                      >
                        {displayStatus(suggestion.status)}
                      </span>
                      {suggestion.model_provider === "fallback" ? (
                        <span className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-xs">
                          Fallback analysis
                        </span>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Generated {formatTimestamp(suggestion.created_at)}
                    </span>
                  </div>
                  <OutcomeContent output={output} />
                  {suggestion.status === "pending" ? (
                    <div className="border-border mt-4 flex flex-wrap gap-2 border-t pt-3">
                      <button
                        type="button"
                        disabled={resolvingId !== null}
                        onClick={() => void resolveSuggestion(suggestion, "accepted")}
                        className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                      >
                        {resolvingId === suggestion.id ? "Saving…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        disabled={resolvingId !== null}
                        onClick={() => startEditing(suggestion)}
                        className="border-border bg-card text-foreground hover:bg-muted h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={resolvingId !== null}
                        onClick={() => void resolveSuggestion(suggestion, "rejected")}
                        className="border-border text-muted-foreground hover:text-destructive h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground border-border mt-4 border-t pt-3 text-xs">
                      Resolved as {displayStatus(suggestion.status)}
                      {suggestion.resolved_at
                        ? ` on ${formatTimestamp(suggestion.resolved_at)}`
                        : ""}
                      . This is history and is no longer awaiting review.
                    </p>
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
          aria-labelledby={`outcome-edit-title-${interviewId}`}
        >
          <div
            ref={dialogRef}
            onKeyDown={trapDialogFocus}
            className="border-border bg-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id={`outcome-edit-title-${interviewId}`}
                  className="text-foreground text-lg font-bold"
                >
                  Edit outcome analysis
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  Edit the analysis while keeping its evidence and scope explicit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={resolvingId !== null}
                aria-label="Close outcome analysis editor"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 space-y-5">
              {editValue.grounded_observations.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Grounded observations
                  </legend>
                  {editValue.grounded_observations.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <textarea
                        autoFocus={index === 0}
                        aria-label={`Observation ${index + 1}`}
                        rows={2}
                        maxLength={1000}
                        value={item.observation}
                        onChange={(event) =>
                          updateObservation(index, { observation: event.target.value })
                        }
                        className={controlClass}
                      />
                      <select
                        aria-label={`Observation ${index + 1} source`}
                        value={item.source_reference}
                        onChange={(event) => {
                          if (isSourceReference(event.target.value)) {
                            updateObservation(index, { source_reference: event.target.value });
                          }
                        }}
                        className={`${controlClass} h-10`}
                      >
                        {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <textarea
                        aria-label={`Observation ${index + 1} evidence`}
                        rows={2}
                        maxLength={1000}
                        value={item.evidence_summary}
                        onChange={(event) =>
                          updateObservation(index, { evidence_summary: event.target.value })
                        }
                        className={controlClass}
                      />
                    </div>
                  ))}
                </fieldset>
              ) : null}
              {editValue.possible_strengths.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Possible strengths
                  </legend>
                  {editValue.possible_strengths.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <input
                        aria-label={`Strength ${index + 1} title`}
                        maxLength={200}
                        value={item.title}
                        onChange={(event) => updateStrength(index, { title: event.target.value })}
                        className={`${controlClass} mt-0 h-10`}
                      />
                      <textarea
                        aria-label={`Strength ${index + 1} explanation`}
                        rows={2}
                        maxLength={1000}
                        value={item.explanation}
                        onChange={(event) =>
                          updateStrength(index, { explanation: event.target.value })
                        }
                        className={controlClass}
                      />
                      <textarea
                        aria-label={`Strength ${index + 1} evidence`}
                        rows={2}
                        maxLength={1000}
                        value={item.evidence_summary}
                        onChange={(event) =>
                          updateStrength(index, { evidence_summary: event.target.value })
                        }
                        className={controlClass}
                      />
                    </div>
                  ))}
                </fieldset>
              ) : null}
              {editValue.possible_growth_areas.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Possible growth areas
                  </legend>
                  {editValue.possible_growth_areas.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <input
                        aria-label={`Growth area ${index + 1}`}
                        maxLength={200}
                        value={item.area}
                        onChange={(event) => updateGrowth(index, { area: event.target.value })}
                        className={`${controlClass} mt-0 h-10`}
                      />
                      <textarea
                        aria-label={`Growth area ${index + 1} rationale`}
                        rows={2}
                        maxLength={1000}
                        value={item.rationale}
                        onChange={(event) => updateGrowth(index, { rationale: event.target.value })}
                        className={controlClass}
                      />
                      <textarea
                        aria-label={`Growth area ${index + 1} action`}
                        rows={2}
                        maxLength={1000}
                        value={item.suggested_action}
                        onChange={(event) =>
                          updateGrowth(index, { suggested_action: event.target.value })
                        }
                        className={controlClass}
                      />
                    </div>
                  ))}
                </fieldset>
              ) : null}
              {editValue.recurring_topics.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Recurring topics
                  </legend>
                  {editValue.recurring_topics.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <input
                        aria-label={`Recurring topic ${index + 1}`}
                        maxLength={200}
                        value={item.topic}
                        onChange={(event) => updateTopic(index, { topic: event.target.value })}
                        className={`${controlClass} mt-0 h-10`}
                      />
                      <p className="text-muted-foreground mt-2 text-xs">
                        API-provided scope: {item.occurrence_context}
                      </p>
                    </div>
                  ))}
                </fieldset>
              ) : null}
              {editValue.recommended_actions.length ? (
                <fieldset className="space-y-3">
                  <legend className="text-foreground text-sm font-semibold">
                    Recommended actions
                  </legend>
                  {editValue.recommended_actions.map((item, index) => (
                    <div key={index} className="border-border rounded-lg border p-3">
                      <textarea
                        aria-label={`Recommended action ${index + 1}`}
                        rows={2}
                        maxLength={1000}
                        value={item.action}
                        onChange={(event) => updateAction(index, { action: event.target.value })}
                        className={`${controlClass} mt-0`}
                      />
                      <select
                        aria-label={`Recommended action ${index + 1} time horizon`}
                        value={item.time_horizon}
                        onChange={(event) => {
                          if (isTimeHorizon(event.target.value)) {
                            updateAction(index, { time_horizon: event.target.value });
                          }
                        }}
                        className={`${controlClass} h-10`}
                      >
                        <option value="before_next_interview">Before next interview</option>
                        <option value="this_week">This week</option>
                        <option value="ongoing">Ongoing</option>
                      </select>
                      <textarea
                        aria-label={`Recommended action ${index + 1} rationale`}
                        rows={2}
                        maxLength={1000}
                        value={item.rationale}
                        onChange={(event) => updateAction(index, { rationale: event.target.value })}
                        className={controlClass}
                      />
                      <textarea
                        aria-label={`Recommended action ${index + 1} related topics`}
                        rows={2}
                        value={item.related_topics.join("\n")}
                        onChange={(event) =>
                          updateAction(index, { related_topics: splitLines(event.target.value) })
                        }
                        className={controlClass}
                      />
                      <p className="text-muted-foreground mt-1 text-xs">
                        One related topic per line; maximum 10.
                      </p>
                    </div>
                  ))}
                </fieldset>
              ) : null}
              <div>
                <label
                  htmlFor={`outcome-follow-up-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Suggested follow-up points
                </label>
                <textarea
                  id={`outcome-follow-up-${interviewId}`}
                  rows={3}
                  value={editValue.suggested_follow_up_points.join("\n")}
                  onChange={(event) =>
                    setEditValue({
                      ...editValue,
                      suggested_follow_up_points: splitLines(event.target.value),
                    })
                  }
                  className={controlClass}
                />
                <p className="text-muted-foreground mt-1 text-xs">One point per line.</p>
              </div>
              <div>
                <label
                  htmlFor={`outcome-uncertainty-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Uncertainty notes
                </label>
                <textarea
                  id={`outcome-uncertainty-${interviewId}`}
                  rows={3}
                  value={editValue.uncertainty_notes.join("\n")}
                  onChange={(event) =>
                    setEditValue({
                      ...editValue,
                      uncertainty_notes: splitLines(event.target.value),
                    })
                  }
                  className={controlClass}
                />
                <p className="text-muted-foreground mt-1 text-xs">One note per line.</p>
              </div>
              <div>
                <label
                  htmlFor={`outcome-limitations-${interviewId}`}
                  className="text-foreground text-sm font-medium"
                >
                  Limitations
                </label>
                <textarea
                  id={`outcome-limitations-${interviewId}`}
                  rows={4}
                  value={editValue.limitations.join("\n")}
                  onChange={(event) =>
                    setEditValue({ ...editValue, limitations: splitLines(event.target.value) })
                  }
                  className={controlClass}
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Required safety limitations must remain present.
                </p>
              </div>
              {editError ? (
                <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {editError}
                </div>
              ) : null}
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
                  {resolvingId ? "Saving…" : "Save edited analysis"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
