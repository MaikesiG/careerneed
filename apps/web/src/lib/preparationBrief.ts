import type { InterviewPreparationBrief, InterviewPreparationSource } from "@/lib/api";

const SOURCE_LABELS: Record<InterviewPreparationSource, string> = {
  job_description: "Job description",
  selected_resume: "Selected resume",
  interview_details: "Interview details",
  interview_notes: "Interview notes",
  participant_context: "Participant context",
};

function formatGroundedItems(items: InterviewPreparationBrief["evidence"]): string {
  return items
    .map((item) => {
      const sources = item.source_refs.map((source) => SOURCE_LABELS[source]).join(", ");
      return `• ${item.text}${sources ? ` [Sources: ${sources}]` : ""}`;
    })
    .join("\n");
}

export function formatActionableBrief(brief: InterviewPreparationBrief): string {
  const parts: string[] = [];

  if (brief.summary?.trim()) {
    parts.push(`Summary:\n${brief.summary.trim()}`);
  }

  if (brief.likely_topics?.length) {
    parts.push(`Likely Topics:\n${brief.likely_topics.map((t) => `• ${t}`).join("\n")}`);
  }

  if (brief.questions_to_prepare?.length) {
    parts.push(
      `Questions to Prepare:\n${brief.questions_to_prepare.map((q) => `• ${q}`).join("\n")}`
    );
  }

  if (brief.participant_context?.length) {
    const participants = brief.participant_context
      .map((p) => `• ${p.name} (${p.role}): ${p.suggested_focus}`)
      .join("\n");
    parts.push(`Participant Context:\n${participants}`);
  }

  if (brief.next_steps?.length) {
    parts.push(`Next Steps:\n${brief.next_steps.map((s) => `• ${s}`).join("\n")}`);
  }

  if (brief.evidence.length) {
    parts.push(`Evidence:\n${formatGroundedItems(brief.evidence)}`);
  }

  if (brief.inferences.length) {
    parts.push(`Analysis / Inference:\n${formatGroundedItems(brief.inferences)}`);
  }

  if (brief.recommendations.length) {
    parts.push(`Recommended Preparation:\n${formatGroundedItems(brief.recommendations)}`);
  }

  if (brief.uncertainties.length) {
    parts.push(
      `Missing or Uncertain Information:\n${brief.uncertainties
        .map((item) => `• ${item.text}`)
        .join("\n")}`
    );
  }

  return parts.join("\n\n");
}
