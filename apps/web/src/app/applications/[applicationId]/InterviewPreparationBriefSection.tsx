"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, InterviewPreparationBrief, isInterviewPreparationBrief } from "@/lib/api";
import { formatActionableBrief } from "@/lib/preparationBrief";

type Props = {
  applicationId: string;
  interviewId: string;
};

function TextList({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-muted-foreground text-sm">None suggested.</p>;
  return (
    <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}


export default function InterviewPreparationBriefSection({ applicationId, interviewId }: Props) {
  const [brief, setBrief] = useState<InterviewPreparationBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [copyNotice, setCopyNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!copyNotice) return;
    const timer = window.setTimeout(() => {
      if (mountedRef.current) {
        setCopyNotice(null);
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [copyNotice]);

  async function generateBrief() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsGenerating(true);
    setError(null);
    setIsUnavailable(false);
    try {
      const response = await apiFetch(
        `/applications/${applicationId}/interviews/${interviewId}/preparation-brief`,
        { method: "POST" }
      );
      if (!response.ok) {
        if (response.status === 503) {
          if (mountedRef.current) setIsUnavailable(true);
          return;
        }
        throw new Error("brief request failed");
      }
      const data: unknown = await response.json();
      if (!isInterviewPreparationBrief(data)) throw new Error("invalid brief response");
      if (mountedRef.current) setBrief(data);
    } catch {
      if (mountedRef.current) {
        setError("Unable to generate the preparation brief. Please try again.");
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setIsGenerating(false);
    }
  }

  async function handleCopyBrief() {
    if (!brief) return;

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyNotice({
        type: "error",
        message: "Clipboard access is unavailable in this environment.",
      });
      return;
    }

    try {
      const content = formatActionableBrief(brief);
      await navigator.clipboard.writeText(content);
      if (mountedRef.current) {
        setCopyNotice({
          type: "success",
          message: "Brief copied to clipboard.",
        });
      }
    } catch {
      if (mountedRef.current) {
        setCopyNotice({
          type: "error",
          message: "Failed to copy brief to clipboard.",
        });
      }
    }
  }

  return (
    <section className="border-border mt-3 border-t pt-3" aria-labelledby={`brief-${interviewId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h5 id={`brief-${interviewId}`} className="text-foreground text-sm font-semibold">
            Interview preparation brief
          </h5>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Focused guidance generated from this interview&apos;s recorded context.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {copyNotice ? (
            <span
              role="status"
              className={`text-xs font-medium ${
                copyNotice.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {copyNotice.message}
            </span>
          ) : null}
          {brief && !isGenerating ? (
            <button
              type="button"
              onClick={() => void handleCopyBrief()}
              className="border-border bg-card hover:bg-muted text-foreground focus-visible:ring-primary h-10 rounded-lg border px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
            >
              Copy Brief
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void generateBrief()}
            disabled={isGenerating}
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary h-10 rounded-lg px-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGenerating
              ? "Generating…"
              : brief
                ? "Generate again"
                : error || isUnavailable
                  ? "Retry"
                  : "Generate preparation brief"}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {isGenerating ? "Generating your interview preparation brief…" : null}
        {isUnavailable
          ? "AI preparation briefs are currently unavailable. Please try again later."
          : null}
        {error ? error : null}
        {copyNotice ? copyNotice.message : null}
      </div>

      {isGenerating ? (
        <div
          className="border-border bg-muted/15 mt-3 space-y-4 rounded-lg border p-4 animate-pulse"
          aria-hidden="true"
        >
          {/* Block 1: Summary */}
          <div className="space-y-2">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted/60 h-16 w-full rounded" />
          </div>

          {/* Block 2: Likely Topics & Questions */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="bg-muted h-4 w-28 rounded" />
              <div className="bg-muted/60 h-12 w-full rounded" />
            </div>
            <div className="space-y-2">
              <div className="bg-muted h-4 w-36 rounded" />
              <div className="bg-muted/60 h-12 w-full rounded" />
            </div>
          </div>

          {/* Block 3: Participant Context & Next Steps */}
          <div className="space-y-2">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted/60 h-10 w-full rounded" />
          </div>
        </div>
      ) : null}

      {isUnavailable ? (
        <p className="text-muted-foreground mt-3 text-sm">
          AI preparation briefs are currently unavailable. Please try again later.
        </p>
      ) : null}
      {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}

      {brief && !isGenerating ? (
        <div className="border-border bg-muted/20 mt-3 space-y-4 rounded-lg border p-3">
          <div>
            <h6 className="text-foreground text-sm font-semibold">Summary</h6>
            <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">
              {brief.summary}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h6 className="text-foreground mb-1 text-sm font-semibold">Likely topics</h6>
              <TextList items={brief.likely_topics} />
            </div>
            <div>
              <h6 className="text-foreground mb-1 text-sm font-semibold">Questions to prepare</h6>
              <TextList items={brief.questions_to_prepare} />
            </div>
          </div>
          {brief.participant_context.length ? (
            <div>
              <h6 className="text-foreground text-sm font-semibold">Participant context</h6>
              <div className="mt-2 space-y-2">
                {brief.participant_context.map((participant, index) => (
                  <div
                    key={`${participant.name}-${participant.role}-${index}`}
                    className="border-border rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground font-medium">{participant.name}</span>
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs capitalize">
                        {participant.role}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1">{participant.suggested_focus}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <h6 className="text-foreground mb-1 text-sm font-semibold">Next steps</h6>
            <TextList items={brief.next_steps} />
          </div>
          <div className="border-primary/30 bg-primary/5 text-muted-foreground rounded-lg border p-3 text-xs">
            <p className="text-foreground font-medium">About this guidance</p>
            <p className="mt-1">{brief.disclaimer}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
