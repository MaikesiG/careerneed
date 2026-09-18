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
