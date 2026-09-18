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

export function isContact(value: unknown): value is Contact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    isNullableString(value.company_id) &&
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
