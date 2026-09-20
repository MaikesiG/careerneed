import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InterviewPreparationBriefSection from "./InterviewPreparationBriefSection";

const mockSuccessBrief = {
  summary: "Focus on distributed system patterns and communication trade-offs.",
  likely_topics: ["Distributed consensus", "Event-driven architecture"],
  questions_to_prepare: [
    "How do you design for high availability across multi-region deployments?",
  ],
  participant_context: [
    {
      name: "Alex Rivera",
      role: "interviewer" as const,
      suggested_focus: "Cloud infrastructure depth and operational trade-offs",
    },
  ],
  next_steps: ["Review Raft consensus paper and prepare latency calculation examples."],
  evidence: [
    {
      text: "The role emphasizes distributed systems.",
      source_refs: ["job_description" as const],
    },
  ],
  inferences: [
    {
      text: "The architecture round may emphasize trade-off reasoning.",
      source_refs: ["interview_details" as const],
    },
  ],
  recommendations: [
    {
      text: "Practice explaining one reliability trade-off.",
      source_refs: ["selected_resume" as const, "interview_notes" as const],
    },
  ],
  uncertainties: [
    {
      text: "<img src=x onerror=alert('not executed')> The exact scenario is unavailable.",
    },
  ],
  disclaimer: "AI-generated preparation guidance. Verify details before relying on it.",
};

describe("InterviewPreparationBriefSection - Group 3: Idle → Skeleton → Successful structured brief", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("progresses from idle to accessible loading skeleton, then displays structured brief with server disclaimer", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() => fetchPromise);

    render(
      <InterviewPreparationBriefSection applicationId="app-test-123" interviewId="int-test-456" />
    );

    // 1. Idle state verification
    expect(
      screen.getByRole("heading", { name: "Interview preparation brief", level: 5 })
    ).toBeInTheDocument();
    const generateButton = screen.getByRole("button", {
      name: "Generate preparation brief",
    });
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toBeEnabled();

    // 2. Trigger brief generation
    fireEvent.click(generateButton);

    // 3. Accessible loading skeleton state
    const loadingButton = screen.getByRole("button", { name: "Generating…" });
    expect(loadingButton).toBeDisabled();

    // Verify accessible screen reader announcement for in-progress generation
    expect(screen.getByText("Generating your interview preparation brief…")).toBeInTheDocument();

    // 4. Resolve mock network request successfully
    resolveFetch(
      new Response(JSON.stringify(mockSuccessBrief), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    // 5. Verify structured brief content rendered correctly
    await waitFor(() => {
      expect(screen.getByText(mockSuccessBrief.summary)).toBeInTheDocument();
    });

    // Likely topics
    expect(screen.getByText("Distributed consensus")).toBeInTheDocument();
    expect(screen.getByText("Event-driven architecture")).toBeInTheDocument();

    // Questions to prepare
    expect(
      screen.getByText("How do you design for high availability across multi-region deployments?")
    ).toBeInTheDocument();

    // Participant context
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("interviewer")).toBeInTheDocument();
    expect(
      screen.getByText("Cloud infrastructure depth and operational trade-offs")
    ).toBeInTheDocument();

    // Next steps
    expect(
      screen.getByText("Review Raft consensus paper and prepare latency calculation examples.")
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByText("The role emphasizes distributed systems.")).toBeInTheDocument();
    expect(screen.getByText("Job description")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analysis / inference" })).toBeInTheDocument();
    expect(screen.getByText("Interview details")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recommended preparation" })).toBeInTheDocument();
    expect(screen.getByText("Selected resume")).toBeInTheDocument();
    expect(screen.getByText("Interview notes")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Missing or uncertain information" })
    ).toBeInTheDocument();
    expect(screen.getByText(/The exact scenario is unavailable/)).toBeInTheDocument();
    expect(document.querySelector("img")).not.toBeInTheDocument();
    expect(screen.queryByText("selected_resume")).not.toBeInTheDocument();

    // Server-owned disclaimer
    expect(screen.getByText(mockSuccessBrief.disclaimer)).toBeInTheDocument();

    // Buttons updated
    expect(screen.getByRole("button", { name: "Copy Brief" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate again" })).toBeInTheDocument();
  });

  it("copies the grounded brief using human-readable source labels", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSuccessBrief), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    render(
      <InterviewPreparationBriefSection applicationId="app-test-123" interviewId="int-test-456" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate preparation brief" }));
    await screen.findByText(mockSuccessBrief.summary);
    fireEvent.click(screen.getByRole("button", { name: "Copy Brief" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Evidence:");
    expect(copied).toContain("Sources: Job description");
    expect(copied).toContain("Analysis / Inference:");
    expect(copied).toContain("Recommended Preparation:");
    expect(copied).toContain("Missing or Uncertain Information:");
    expect(copied).not.toContain("selected_resume");
  });
});

describe("InterviewPreparationBriefSection - Group 4: Error resilience & safe messaging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles HTTP 503 unavailable gracefully, displays Retry, and suppresses raw provider errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: "Upstream provider 503: Vertex AI resource exhausted for model gemini-1.5-pro",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    );

    render(
      <InterviewPreparationBriefSection applicationId="app-test-123" interviewId="int-test-456" />
    );

    const generateButton = screen.getByRole("button", {
      name: "Generate preparation brief",
    });
    fireEvent.click(generateButton);

    const visibleUnavailable = await screen.findByText(
      "AI preparation briefs are currently unavailable. Please try again later.",
      { selector: "p" }
    );
    expect(visibleUnavailable).toBeInTheDocument();
    expect(visibleUnavailable).toBeVisible();

    const liveAnnouncement = screen.getByText(
      "AI preparation briefs are currently unavailable. Please try again later.",
      { selector: "[aria-live='polite']" }
    );
    expect(liveAnnouncement).toBeInTheDocument();

    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent(
      "AI preparation briefs are currently unavailable. Please try again later."
    );

    // Retry action is rendered
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).toBeEnabled();

    // Never renders raw provider details
    expect(screen.queryByText(/Vertex AI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gemini/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resource exhausted/i)).not.toBeInTheDocument();

    // Clicking Retry works
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSuccessBrief), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    fireEvent.click(retryButton);
    await screen.findByText(mockSuccessBrief.summary);
    expect(screen.getByText(mockSuccessBrief.summary)).toBeInTheDocument();
  });

  it("handles generic failure safely, displays Retry, and suppresses raw technical error messages", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("ECONNREFUSED 127.0.0.1:8000 socket hang up at TCPConnectWrap.afterConnect")
    );

    render(
      <InterviewPreparationBriefSection applicationId="app-test-123" interviewId="int-test-456" />
    );

    const generateButton = screen.getByRole("button", {
      name: "Generate preparation brief",
    });
    fireEvent.click(generateButton);

    const visibleError = await screen.findByText(
      "Unable to generate the preparation brief. Please try again.",
      { selector: "p" }
    );
    expect(visibleError).toBeInTheDocument();
    expect(visibleError).toBeVisible();

    const liveAnnouncement = screen.getByText(
      "Unable to generate the preparation brief. Please try again.",
      { selector: "[aria-live='polite']" }
    );
    expect(liveAnnouncement).toBeInTheDocument();

    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent(
      "Unable to generate the preparation brief. Please try again."
    );

    // Retry button rendered
    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeInTheDocument();

    // Technical error text suppressed
    expect(screen.queryByText(/ECONNREFUSED/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/socket hang up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/TCPConnectWrap/i)).not.toBeInTheDocument();

    // Clicking Retry works
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSuccessBrief), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    fireEvent.click(retryButton);
    await screen.findByText(mockSuccessBrief.summary);
    expect(screen.getByText(mockSuccessBrief.summary)).toBeInTheDocument();
  });
});
