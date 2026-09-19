import type { InterviewPreparationBrief } from "@/lib/api";

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

  return parts.join("\n\n");
}
