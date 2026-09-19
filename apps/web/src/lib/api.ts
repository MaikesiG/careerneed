export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type ApiError = {
  detail?: string;
};

/**
 * Browser-only API client. Credentials are intentionally forced to "include"
 * so authenticated requests always send the session cookie.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });
}

export async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return typeof body.detail === "string" ? body.detail : fallback;
  } catch {
    return fallback;
  }
}

export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export type ApplicationListItem = {
  id: string;
  job_id: string;
  resume_id: string | null;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  follow_up_on: string | null;
  next_open_follow_up_at: string | null;
  open_follow_up_count: number;
  created_at: string;
  updated_at: string;
  job: {
    id: string;
    company_name: string;
    source: string;
    title: string;
    location: string | null;
    workplace_type: string | null;
    application_url: string;
  };
};

export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";
export type InterviewResult = "pending" | "passed" | "failed" | "unknown";
export type InterviewType =
  | "recruiter"
  | "technical"
  | "coding"
  | "system_design"
  | "behavioral"
  | "hiring_manager"
  | "portfolio_review"
  | "case_study"
  | "role_play"
  | "presentation"
  | "take_home"
  | "panel"
  | "final"
  | "other";

export type Interview = {
  id: string;
  application_id: string;
  round: number;
  title: string;
  interview_type: InterviewType;
  scheduled_at: string | null;
  duration_minutes: number | null;
  timezone: string | null;
  status: InterviewStatus;
  result: InterviewResult;
  interviewer_name: string | null;
  interviewer_title: string | null;
  interviewer_email: string | null;
  meeting_url: string | null;
  location: string | null;
  notes: string | null;
  preparation_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UpcomingInterview = Interview & {
  company_name: string;
  job_title: string;
};

export type InterviewExtraction = {
  round: number;
  title: string;
  interview_type: InterviewType;
  scheduled_at: string | null;
  duration_minutes: number | null;
  timezone: string | null;
  interviewer_name: string | null;
  interviewer_title: string | null;
  interviewer_email: string | null;
  meeting_url: string | null;
  location: string | null;
  notes: string | null;
  company: string | null;
  role: string | null;
};

export type InterviewPreparationBriefParticipantContext = {
  name: string;
  role: ParticipantRole;
  suggested_focus: string;
};

export type InterviewPreparationBrief = {
  summary: string;
  likely_topics: string[];
  questions_to_prepare: string[];
  participant_context: InterviewPreparationBriefParticipantContext[];
  next_steps: string[];
  disclaimer: string;
};

export type InterviewQuestionCategory =
  | "behavioral"
  | "technical"
  | "coding"
  | "system_design"
  | "case"
  | "product"
  | "culture"
  | "other";

export type InterviewQuestionDifficulty = "easy" | "medium" | "hard" | "unknown";

export type InterviewQuestion = {
  id: string;
  interview_id: string;
  question: string;
  category: InterviewQuestionCategory;
  difficulty: InterviewQuestionDifficulty;
  answer_notes: string | null;
  reflection: string | null;
  leetcode_url: string | null;
  asked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowUpType =
  "thank_you" | "status_check" | "recruiter_reply" | "preparation" | "custom";

export type InterviewFollowUp = {
  id: string;
  user_id: string;
  application_id: string;
  interview_id: string | null;
  type: FollowUpType;
  title: string;
  due_at_utc: string;
  timezone: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TodayPriorityGroupKey =
  | "overdue_follow_ups"
  | "interviews_today"
  | "follow_ups_due_today"
  | "upcoming_interviews"
  | "applications_needing_update";

export type TodayPriorityActionKind = "follow_up" | "interview" | "application_update";

export type TodayPriorityItem = {
  id: string;
  action_kind: TodayPriorityActionKind;
  title: string;
  application_id: string;
  company_name: string;
  job_title: string;
  interview_id: string | null;
  interview_title?: string | null;
  interview_round?: number | null;
  occurs_at: string | null;
  timezone: string | null;
  status: string | null;
};

export type TodayPriorityGroup = {
  key: TodayPriorityGroupKey;
  priority: number;
  items: TodayPriorityItem[];
};

export type TodayPrioritiesResponse = {
  timezone: string;
  local_date: string;
  groups: TodayPriorityGroup[];
};

export type PrepPriority = {
  title: string;
  reason: string;
  recommended_action: string;
  priority: "high" | "medium" | "low";
};

export type TechnicalTopic = {
  topic: string;
  reason: string;
  recommended_actions: string[];
};

export type BehavioralStory = {
  story_or_evidence: string;
  relevance: string;
  suggested_angle: string;
};

export type LikelyQuestion = {
  question: string;
  category: InterviewQuestionCategory;
  reason: string;
  recommended_angle: string;
};

export type GapWarning = {
  area: string;
  reason: string;
  suggested_action: string;
  confidence: number | null;
};

export type ReadinessBreakdown = {
  technical_depth: number | null;
  role_context: number | null;
  behavioral_examples: number | null;
  logistics_and_preparation: number | null;
};

export type InterviewPrepOutput = {
  summary: string;
  preparation_priorities: PrepPriority[];
  technical_topics: TechnicalTopic[];
  behavioral_stories: BehavioralStory[];
  likely_questions: LikelyQuestion[];
  questions_to_ask: string[];
  gap_warnings: GapWarning[];
  limitations_or_uncertainties: string[];
  readiness: {
    score: number | null;
    summary: string;
    breakdown: ReadinessBreakdown;
    limitations: string[];
  };
};

export type AISuggestionStatus =
  "pending" | "accepted" | "rejected" | "edited" | "expired" | "failed" | "superseded";

export type InterviewPrepSuggestion = {
  id: string;
  interview_id: string;
  entity_type: string;
  entity_id: string | null;
  suggestion_type: "interview_prep";
  proposed_value: InterviewPrepOutput;
  confidence: number | null;
  rationale: string | null;
  model_provider: string;
  model_version: string;
  prompt_version: string;
  output_schema_version: string;
  input_snapshot_hash: string;
  status: AISuggestionStatus;
  resolved_value: InterviewPrepOutput | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OutcomeSourceReference =
  "interview_notes" | "question" | "answer_notes" | "reflection" | "interview_result";

export type GroundedObservation = {
  observation: string;
  source_reference: OutcomeSourceReference;
  evidence_summary: string;
  confidence: number | null;
};

export type OutcomeInsight = {
  title: string;
  explanation: string;
  evidence_summary: string;
  confidence: number | null;
};

export type OutcomeGrowthArea = {
  area: string;
  rationale: string;
  suggested_action: string;
  confidence: number | null;
};

export type OutcomeRecurringTopic = {
  topic: string;
  occurrence_context: string;
  confidence: number | null;
};

export type OutcomeRecommendedAction = {
  action: string;
  time_horizon: "before_next_interview" | "this_week" | "ongoing";
  rationale: string;
  related_topics: string[];
};

export type OutcomeAnalysisScope = {
  interviews_considered: number;
  questions_considered: number;
  notes_available: boolean;
  result_recorded: boolean;
  data_limitations: string[];
};

export type InterviewOutcomeAnalysisOutput = {
  grounded_observations: GroundedObservation[];
  possible_strengths: OutcomeInsight[];
  possible_growth_areas: OutcomeGrowthArea[];
  recurring_topics: OutcomeRecurringTopic[];
  recommended_actions: OutcomeRecommendedAction[];
  suggested_follow_up_points: string[];
  uncertainty_notes: string[];
  limitations: string[];
  analysis_scope: OutcomeAnalysisScope;
};

export type InterviewOutcomeSuggestion = {
  id: string;
  interview_id: string;
  entity_type: string;
  entity_id: string | null;
  suggestion_type: "interview_outcome_analysis";
  proposed_value: InterviewOutcomeAnalysisOutput;
  confidence: number | null;
  rationale: string | null;
  model_provider: string;
  model_version: string;
  prompt_version: string;
  output_schema_version: string;
  input_snapshot_hash: string;
  status: AISuggestionStatus;
  resolved_value: InterviewOutcomeAnalysisOutput | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactRelationshipType =
  "recruiter" | "interviewer" | "hiring_manager" | "referral" | "networking" | "other";

export type ParticipantRole = "interviewer" | "coordinator" | "observer";

export type Contact = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_name?: string | null;
  name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship_type: ContactRelationshipType;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ParticipantContact = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship_type: ContactRelationshipType;
};

export type InterviewParticipant = {
  id: string;
  interview_id: string;
  contact_id: string;
  role: ParticipantRole;
  created_at: string;
  updated_at: string;
  contact: ParticipantContact;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableBoundedNumber(
  value: unknown,
  minimum: number,
  maximum: number
): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum)
  );
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value));
}

export function isTodayPriorityActionKind(value: unknown): value is TodayPriorityActionKind {
  return value === "follow_up" || value === "interview" || value === "application_update";
}

export function isTodayPriorityItem(value: unknown): value is TodayPriorityItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isTodayPriorityActionKind(value.action_kind) &&
    typeof value.title === "string" &&
    typeof value.application_id === "string" &&
    typeof value.company_name === "string" &&
    typeof value.job_title === "string" &&
    isNullableString(value.interview_id) &&
    (value.interview_title === undefined || isNullableString(value.interview_title)) &&
    (value.interview_round === undefined || isNullableInteger(value.interview_round)) &&
    isNullableString(value.occurs_at) &&
    isNullableString(value.timezone) &&
    isNullableString(value.status)
  );
}

export function isAISuggestionStatus(value: unknown): value is AISuggestionStatus {
  return (
    value === "pending" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "edited" ||
    value === "expired" ||
    value === "failed" ||
    value === "superseded"
  );
}

function isInterviewQuestionCategoryValue(value: unknown): value is InterviewQuestionCategory {
  return (
    value === "behavioral" ||
    value === "technical" ||
    value === "coding" ||
    value === "system_design" ||
    value === "case" ||
    value === "product" ||
    value === "culture" ||
    value === "other"
  );
}

export function isInterviewPrepOutput(value: unknown): value is InterviewPrepOutput {
  if (!isRecord(value) || !isRecord(value.readiness)) return false;
  const readiness = value.readiness;
  if (!isRecord(readiness.breakdown)) return false;
  const breakdown = readiness.breakdown;
  return (
    typeof value.summary === "string" &&
    Array.isArray(value.preparation_priorities) &&
    value.preparation_priorities.every(
      (item) =>
        isRecord(item) &&
        typeof item.title === "string" &&
        typeof item.reason === "string" &&
        typeof item.recommended_action === "string" &&
        (item.priority === "high" || item.priority === "medium" || item.priority === "low")
    ) &&
    Array.isArray(value.technical_topics) &&
    value.technical_topics.every(
      (item) =>
        isRecord(item) &&
        typeof item.topic === "string" &&
        typeof item.reason === "string" &&
        isStringArray(item.recommended_actions)
    ) &&
    Array.isArray(value.behavioral_stories) &&
    value.behavioral_stories.every(
      (item) =>
        isRecord(item) &&
        typeof item.story_or_evidence === "string" &&
        typeof item.relevance === "string" &&
        typeof item.suggested_angle === "string"
    ) &&
    Array.isArray(value.likely_questions) &&
    value.likely_questions.every(
      (item) =>
        isRecord(item) &&
        typeof item.question === "string" &&
        isInterviewQuestionCategoryValue(item.category) &&
        typeof item.reason === "string" &&
        typeof item.recommended_angle === "string"
    ) &&
    isStringArray(value.questions_to_ask) &&
    Array.isArray(value.gap_warnings) &&
    value.gap_warnings.every(
      (item) =>
        isRecord(item) &&
        typeof item.area === "string" &&
        typeof item.reason === "string" &&
        typeof item.suggested_action === "string" &&
        isNullableBoundedNumber(item.confidence, 0, 1)
    ) &&
    isStringArray(value.limitations_or_uncertainties) &&
    isNullableBoundedNumber(readiness.score, 0, 100) &&
    typeof readiness.summary === "string" &&
    isNullableBoundedNumber(breakdown.technical_depth, 0, 100) &&
    isNullableBoundedNumber(breakdown.role_context, 0, 100) &&
    isNullableBoundedNumber(breakdown.behavioral_examples, 0, 100) &&
    isNullableBoundedNumber(breakdown.logistics_and_preparation, 0, 100) &&
    isStringArray(readiness.limitations)
  );
}

export function isInterviewPrepSuggestion(value: unknown): value is InterviewPrepSuggestion {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.interview_id === "string" &&
    typeof value.entity_type === "string" &&
    isNullableString(value.entity_id) &&
    value.suggestion_type === "interview_prep" &&
    isInterviewPrepOutput(value.proposed_value) &&
    (value.resolved_value === null || isInterviewPrepOutput(value.resolved_value)) &&
    isNullableBoundedNumber(value.confidence, 0, 1) &&
    isNullableString(value.rationale) &&
    typeof value.model_provider === "string" &&
    typeof value.model_version === "string" &&
    typeof value.prompt_version === "string" &&
    typeof value.output_schema_version === "string" &&
    typeof value.input_snapshot_hash === "string" &&
    isAISuggestionStatus(value.status) &&
    isNullableString(value.resolved_at) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

export function isInterviewPrepSuggestionArray(value: unknown): value is InterviewPrepSuggestion[] {
  return Array.isArray(value) && value.every(isInterviewPrepSuggestion);
}

export function isContactRelationshipType(value: unknown): value is ContactRelationshipType {
  return (
    value === "recruiter" ||
    value === "interviewer" ||
    value === "hiring_manager" ||
    value === "referral" ||
    value === "networking" ||
    value === "other"
  );
}

export function isParticipantRole(value: unknown): value is ParticipantRole {
  return value === "interviewer" || value === "coordinator" || value === "observer";
}

export function isInterviewPreparationBrief(value: unknown): value is InterviewPreparationBrief {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    isStringArray(value.likely_topics) &&
    isStringArray(value.questions_to_prepare) &&
    Array.isArray(value.participant_context) &&
    value.participant_context.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === "string" &&
        isParticipantRole(item.role) &&
        typeof item.suggested_focus === "string"
    ) &&
    isStringArray(value.next_steps) &&
    typeof value.disclaimer === "string"
  );
}

export function isContact(value: unknown): value is Contact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    isNullableString(value.company_id) &&
    (value.company_name === undefined || isNullableString(value.company_name)) &&
    typeof value.name === "string" &&
    isNullableString(value.title) &&
    isNullableString(value.email) &&
    isNullableString(value.linkedin_url) &&
    isContactRelationshipType(value.relationship_type) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

export function isContactArray(value: unknown): value is Contact[] {
  return Array.isArray(value) && value.every(isContact);
}

export function isParticipantContact(value: unknown): value is ParticipantContact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.title) &&
    isNullableString(value.email) &&
    isNullableString(value.linkedin_url) &&
    isContactRelationshipType(value.relationship_type)
  );
}

export function isInterviewParticipant(value: unknown): value is InterviewParticipant {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.interview_id === "string" &&
    typeof value.contact_id === "string" &&
    isParticipantRole(value.role) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    isParticipantContact(value.contact)
  );
}

export function isInterviewParticipantArray(value: unknown): value is InterviewParticipant[] {
  return Array.isArray(value) && value.every(isInterviewParticipant);
}

export type ApplicationContactCanonicalSummary = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship_type: ContactRelationshipType;
};

export type ApplicationContact = {
  id: string;
  application_id: string;
  contact_id: string | null;
  name: string;
  contact_type: string;
  email: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contact: ApplicationContactCanonicalSummary | null;
};

export function isApplicationContactCanonicalSummary(
  value: unknown
): value is ApplicationContactCanonicalSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isNullableString(value.title) &&
    isNullableString(value.email) &&
    isNullableString(value.linkedin_url) &&
    isContactRelationshipType(value.relationship_type)
  );
}

export function isApplicationContact(value: unknown): value is ApplicationContact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.application_id === "string" &&
    isNullableString(value.contact_id) &&
    typeof value.name === "string" &&
    typeof value.contact_type === "string" &&
    isNullableString(value.email) &&
    isNullableString(value.linkedin_url) &&
    isNullableString(value.notes) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (value.contact === null ||
      value.contact === undefined ||
      isApplicationContactCanonicalSummary(value.contact))
  );
}

export function isApplicationContactArray(value: unknown): value is ApplicationContact[] {
  return Array.isArray(value) && value.every(isApplicationContact);
}
