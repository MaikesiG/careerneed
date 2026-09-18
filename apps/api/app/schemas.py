import uuid
from datetime import date, datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, field_validator

JobStatus = Literal["new", "saved", "applied", "dismissed"]


class JobBase(BaseModel):
    company_name: str
    title: str
    location: str | None = None
    workplace_type: str | None = None
    description: str | None = None
    application_url: str
    source_url: str | None = None


class JobManualCreate(JobBase):
    notes: str | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    source: str
    source_type: str
    title: str
    location: str | None
    workplace_type: str | None
    application_url: str
    status: str
    match_score: int | None
    posted_at: datetime | None
    first_seen_at: datetime


class JobDetail(JobOut):
    description: str | None
    source_url: str | None


class JobStatusUpdate(BaseModel):
    status: JobStatus


class CompanyCreate(BaseModel):
    name: str
    source_type: Literal["ashby", "greenhouse", "lever", "custom", "manual"]
    board_token: str | None = None
    careers_url: str | None = None
    priority: Literal["high", "medium", "low"] = "medium"


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    source_type: str
    board_token: str | None = None
    careers_url: str | None = None
    priority: str
    active: bool


class ResumeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    skills: str | None
    label: str | None
    is_default: bool
    archived_at: datetime | None
    source: str | None
    uploaded_at: datetime


class ResumeDetail(ResumeOut):
    raw_text: str


class ResumeUpdate(BaseModel):
    label: str | None = None
    is_default: bool | None = None
    archived_at: datetime | None = None


ApplicationStatus = Literal[
    "saved",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "withdrawn",
]


class ApplicationCreate(BaseModel):
    job_id: uuid.UUID
    resume_id: uuid.UUID | None = None
    status: ApplicationStatus = "saved"
    notes: str | None = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    resume_id: uuid.UUID | None
    status: ApplicationStatus
    applied_at: datetime | None
    notes: str | None
    follow_up_on: date | None
    created_at: datetime
    updated_at: datetime


class ApplicationJobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_name: str
    source: str
    title: str
    location: str | None
    workplace_type: str | None
    application_url: str


class ApplicationWithJobOut(ApplicationOut):
    job: ApplicationJobSummary


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    resume_id: uuid.UUID | None = None
    applied_at: datetime | None = None
    notes: str | None = None
    follow_up_on: date | None = None


class ApplicationByJobUpdate(BaseModel):
    status: ApplicationStatus
    resume_id: uuid.UUID | None = None
    notes: str | None = None


class ApplicationJobState(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    resume_id: uuid.UUID | None
    status: ApplicationStatus
    applied_at: datetime | None
    notes: str | None
    follow_up_on: date | None


class ApplicationJobStateMap(BaseModel):
    states: dict[str, ApplicationJobState]


class DashboardSummaryOut(BaseModel):
    follow_ups_due_today: int
    follow_ups_overdue: int
    applications_saved: int
    applications_applied: int
    applications_interviewing: int
    active_applications: int


class DashboardFollowUpsOut(BaseModel):
    items: list[ApplicationWithJobOut]


LLMProvider = Literal["openai", "groq", "anthropic"]


class LLMCredentialCreate(BaseModel):
    provider: Literal["openai", "groq", "openrouter"]
    api_key: str


class LLMCredentialOut(BaseModel):
    provider: str
    masked_key: str
    updated_at: datetime


class ExtractionModeOut(BaseModel):
    mode: Literal["byok", "platform", "basic"]
    free_calls_remaining: int | None


class ApplicationContactCreate(BaseModel):
    name: str
    contact_type: str = "other"
    email: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None


class ApplicationContactUpdate(BaseModel):
    name: str | None = None
    contact_type: str | None = None
    email: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None


class ApplicationContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    name: str
    contact_type: str
    email: str | None
    linkedin_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class AuthCredentials(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    created_at: datetime


InterviewStatus = Literal[
    "scheduled",
    "completed",
    "cancelled",
    "rescheduled",
]

InterviewResult = Literal[
    "pending",
    "passed",
    "failed",
    "unknown",
]

InterviewType = Literal[
    "recruiter",
    "technical",
    "coding",
    "system_design",
    "behavioral",
    "hiring_manager",
    "portfolio_review",
    "case_study",
    "role_play",
    "presentation",
    "take_home",
    "panel",
    "final",
    "other",
]


class InterviewBase(BaseModel):
    round: int = 1
    title: str
    interview_type: str = "technical"
    scheduled_at: datetime | None = None
    duration_minutes: int | None = 60
    timezone: str | None = None
    status: InterviewStatus = "scheduled"
    result: InterviewResult = "pending"
    interviewer_name: str | None = None
    interviewer_title: str | None = None
    interviewer_email: str | None = None
    meeting_url: str | None = None
    location: str | None = None
    notes: str | None = None
    preparation_notes: str | None = None


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    round: int | None = None
    title: str | None = None
    interview_type: str | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    timezone: str | None = None
    status: InterviewStatus | None = None
    result: InterviewResult | None = None
    interviewer_name: str | None = None
    interviewer_title: str | None = None
    interviewer_email: str | None = None
    meeting_url: str | None = None
    location: str | None = None
    notes: str | None = None
    preparation_notes: str | None = None


class InterviewOut(InterviewBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class UpcomingInterviewOut(InterviewOut):
    company_name: str
    job_title: str


class FastCaptureRequest(BaseModel):
    raw_text: str
    application_id: uuid.UUID | None = None


class InterviewExtraction(BaseModel):
    round: int = 1
    title: str = "Interview"
    interview_type: str = "technical"
    scheduled_at: datetime | None = None
    duration_minutes: int | None = 60
    timezone: str | None = None
    interviewer_name: str | None = None
    interviewer_title: str | None = None
    interviewer_email: str | None = None
    meeting_url: str | None = None
    location: str | None = None
    notes: str | None = None
    company: str | None = None
    role: str | None = None


QuestionCategory = Literal[
    "behavioral",
    "technical",
    "coding",
    "system_design",
    "case",
    "product",
    "culture",
    "other",
]

QuestionDifficulty = Literal[
    "easy",
    "medium",
    "hard",
    "unknown",
]


def _validate_question_text(v: str) -> str:
    stripped = v.strip()
    if not stripped:
        raise ValueError("Question cannot be blank or whitespace only")
    if len(stripped) > 10000:
        raise ValueError("Question cannot exceed 10,000 characters")
    return stripped


def _validate_notes_text(v: str | None) -> str | None:
    if v is None:
        return None
    stripped = v.strip()
    if not stripped:
        return None
    if len(stripped) > 10000:
        raise ValueError("Text cannot exceed 10,000 characters")
    return stripped


def _validate_leetcode_url(v: str | None) -> str | None:
    if v is None:
        return None
    trimmed = v.strip()
    if not trimmed:
        return None
    try:
        parsed = urlparse(trimmed)
    except Exception as e:
        raise ValueError("Invalid URL format") from e

    if parsed.scheme.lower() != "https":
        raise ValueError("LeetCode URL must use the HTTPS scheme")
    if parsed.username or parsed.password:
        raise ValueError("LeetCode URL must not contain user credentials")

    hostname = (parsed.hostname or "").lower()
    if hostname not in ("leetcode.com", "www.leetcode.com"):
        raise ValueError("LeetCode URL host must be leetcode.com or www.leetcode.com")

    path = parsed.path.strip("/")
    if not path:
        raise ValueError("LeetCode URL must include a problem path")
    return trimmed


def _validate_timezone_aware(v: datetime | None) -> datetime | None:
    if v is None:
        return None
    if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
        raise ValueError("asked_at must be a timezone-aware datetime")
    return v


class InterviewQuestionCreate(BaseModel):
    question: str
    category: QuestionCategory = "technical"
    difficulty: QuestionDifficulty = "unknown"
    answer_notes: str | None = None
    reflection: str | None = None
    leetcode_url: str | None = None
    asked_at: datetime | None = None

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        return _validate_question_text(v)

    @field_validator("answer_notes", "reflection")
    @classmethod
    def validate_notes(cls, v: str | None) -> str | None:
        return _validate_notes_text(v)

    @field_validator("leetcode_url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        return _validate_leetcode_url(v)

    @field_validator("asked_at")
    @classmethod
    def validate_asked_at(cls, v: datetime | None) -> datetime | None:
        return _validate_timezone_aware(v)


class InterviewQuestionUpdate(BaseModel):
    question: str | None = None
    category: QuestionCategory | None = None
    difficulty: QuestionDifficulty | None = None
    answer_notes: str | None = None
    reflection: str | None = None
    leetcode_url: str | None = None
    asked_at: datetime | None = None

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str | None) -> str | None:
        if v is not None:
            return _validate_question_text(v)
        return None

    @field_validator("answer_notes", "reflection")
    @classmethod
    def validate_notes(cls, v: str | None) -> str | None:
        return _validate_notes_text(v)

    @field_validator("leetcode_url")
    @classmethod
    def validate_url(cls, v: str | None) -> str | None:
        return _validate_leetcode_url(v)

    @field_validator("asked_at")
    @classmethod
    def validate_asked_at(cls, v: datetime | None) -> datetime | None:
        return _validate_timezone_aware(v)


class InterviewQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    interview_id: uuid.UUID
    question: str
    category: str
    difficulty: str
    answer_notes: str | None
    reflection: str | None
    leetcode_url: str | None
    asked_at: datetime | None
    created_at: datetime
    updated_at: datetime


