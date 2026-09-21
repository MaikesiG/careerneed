import { describe, it, expect } from "vitest";
import { formatActionableBrief } from "./preparationBrief";
import type { InterviewPreparationBrief } from "./api";

describe("formatActionableBrief - Group 5: Actionable text formatting & exclusions", () => {
  const sampleBrief: InterviewPreparationBrief = {
    summary: "Senior backend engineering focus with emphasis on distributed storage.",
    likely_topics: ["LSM-trees vs B-trees", "Write-ahead logging", "Replication protocols"],
    questions_to_prepare: [
      "Explain how compaction works in LSM-tree based engines.",
      "How do you resolve split-brain scenarios in distributed clusters?",
    ],
    participant_context: [
      {
        name: "David Kim",
        role: "interviewer",
        suggested_focus: "Storage engine internals and benchmark trade-offs",
      },
      {
        name: "Elena Rostova",
        role: "coordinator",
        suggested_focus: "Logistics and timeline coordination",
      },
    ],
    next_steps: [
      "Review RocksDB compaction tuning guide.",
      "Prepare questions regarding write throughput expectations.",
    ],
    disclaimer:
      "AI-generated preparation advice is for rehearsal only. Evaluate all suggestions with care.",
  };

  it("contains only the five allowed actionable sections in the output", () => {
    const formatted = formatActionableBrief(sampleBrief);

    // Verify presence of all 5 allowed sections
    expect(formatted).toContain(
      "Summary:\nSenior backend engineering focus with emphasis on distributed storage."
    );
    expect(formatted).toContain(
      "Likely Topics:\n• LSM-trees vs B-trees\n• Write-ahead logging\n• Replication protocols"
    );
    expect(formatted).toContain(
      "Questions to Prepare:\n• Explain how compaction works in LSM-tree based engines.\n• How do you resolve split-brain scenarios in distributed clusters?"
    );
    expect(formatted).toContain(
      "Participant Context:\n• David Kim (interviewer): Storage engine internals and benchmark trade-offs\n• Elena Rostova (coordinator): Logistics and timeline coordination"
    );
    expect(formatted).toContain(
      "Next Steps:\n• Review RocksDB compaction tuning guide.\n• Prepare questions regarding write throughput expectations."
    );
  });

  it("strictly excludes the disclaimer from the formatted actionable output", () => {
    const briefWithSensationalDisclaimer: InterviewPreparationBrief = {
      ...sampleBrief,
      disclaimer: "CONFIDENTIAL WARNING: AI generated recommendations. Strictly unverified.",
    };

    const formatted = formatActionableBrief(briefWithSensationalDisclaimer);

    expect(formatted).not.toContain("CONFIDENTIAL WARNING");
    expect(formatted).not.toContain("Strictly unverified");
    expect(formatted.toLowerCase()).not.toContain("disclaimer");
  });

  it("strictly excludes internal IDs, metadata, diagnostics, and runtime errors", () => {
    // Cast an object with extra technical fields to test exclusion
    const briefWithExtraTechnicalMetadata = {
      ...sampleBrief,
      id: "brief-uuid-9988-7766",
      application_id: "app-id-1234",
      interview_id: "int-id-5678",
      model_provider: "anthropic-claude-3-5",
      prompt_version: "v2.1.0",
      latency_ms: 1420,
      tokens_used: 850,
      diagnostics: "No anomalies detected during generation",
      error: "Previous transient timeout resolved",
    } as unknown as InterviewPreparationBrief;

    const formatted = formatActionableBrief(briefWithExtraTechnicalMetadata);

    expect(formatted).not.toContain("brief-uuid-9988-7766");
    expect(formatted).not.toContain("app-id-1234");
    expect(formatted).not.toContain("int-id-5678");
    expect(formatted).not.toContain("anthropic-claude-3-5");
    expect(formatted).not.toContain("v2.1.0");
    expect(formatted).not.toContain("latency_ms");
    expect(formatted).not.toContain("tokens_used");
    expect(formatted).not.toContain("No anomalies detected");
    expect(formatted).not.toContain("Previous transient timeout");
  });

  it("omits empty or whitespace-only sections cleanly without producing orphan headers", () => {
    const sparseBrief: InterviewPreparationBrief = {
      summary: "High-level review only.",
      likely_topics: [],
      questions_to_prepare: ["What is your greatest technical challenge?"],
      participant_context: [],
      next_steps: [],
      disclaimer: "Disclaimer text",
    };

    const formatted = formatActionableBrief(sparseBrief);

    expect(formatted).toContain("Summary:\nHigh-level review only.");
    expect(formatted).toContain(
      "Questions to Prepare:\n• What is your greatest technical challenge?"
    );
    expect(formatted).not.toContain("Likely Topics");
    expect(formatted).not.toContain("Participant Context");
    expect(formatted).not.toContain("Next Steps");
  });
});
