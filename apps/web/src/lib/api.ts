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
