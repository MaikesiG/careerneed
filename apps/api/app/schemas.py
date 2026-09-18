import uuid
from datetime import date, datetime, timezone
from typing import Literal
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


TodayPriorityGroupKey = Literal[
    "overdue_follow_ups",
    "interviews_today",
    "follow_ups_due_today",
    "upcoming_interviews",
    "applications_needing_update",
]

TodayPriorityActionKind = Literal[
    "follow_up",
    "interview",
    "application_update",
]


class TodayPriorityItem(BaseModel):
    id: uuid.UUID
    action_kind: TodayPriorityActionKind
    title: str
    application_id: uuid.UUID
    company_name: str
    job_title: str
    interview_id: uuid.UUID | None = None
    occurs_at: datetime | None = None
    timezone: str | None = None
    status: str | None = None


class TodayPriorityGroup(BaseModel):
    key: TodayPriorityGroupKey
    priority: int
    items: list[TodayPriorityItem]


class TodayPrioritiesOut(BaseModel):
    timezone: str
    local_date: date
    groups: list[TodayPriorityGroup]


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


ContactRelationshipType = Literal[
    "recruiter",
    "interviewer",
    "hiring_manager",
    "referral",
    "networking",
    "other",
]


class ApplicationContactCreate(BaseModel):
    contact_id: uuid.UUID | None = None
    name: str | None = None
    contact_type: str = "other"
    email: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_name_present_if_no_contact_id(self) -> "ApplicationContactCreate":
        if self.contact_id is None and not (self.name and self.name.strip()):
            raise ValueError("name is required when contact_id is not provided")
        return self


class ApplicationContactUpdate(BaseModel):
    contact_id: uuid.UUID | None = None
    name: str | None = None
    contact_type: str | None = None
    email: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None


class ApplicationContactCanonicalSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    title: str | None
    email: str | None
    linkedin_url: str | None
    relationship_type: ContactRelationshipType


class ApplicationContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    contact_id: uuid.UUID | None
    name: str
    contact_type: str
    email: str | None
    linkedin_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    contact: ApplicationContactCanonicalSummary | None


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


ParticipantRole = Literal["interviewer", "coordinator", "observer"]


def _trim_contact_required(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Name cannot be blank")
    return value


def _trim_contact_optional(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _validate_contact_email(value: str | None) -> str | None:
    value = _trim_contact_optional(value)
    if value is None:
        return None
    if value.count("@") != 1 or any(character.isspace() for character in value):
        raise ValueError("Email must be valid")
    local_part, domain = value.rsplit("@", 1)
    if not local_part or "." not in domain or domain.startswith(".") or domain.endswith("."):
        raise ValueError("Email must be valid")
    return value


def _validate_linkedin_url(value: str | None) -> str | None:
    value = _trim_contact_optional(value)
    if value is None:
        return None
    parsed = urlparse(value)
    hostname = (parsed.hostname or "").lower()
    if (
        parsed.scheme.lower() != "https"
        or parsed.username
        or parsed.password
        or not (hostname == "linkedin.com" or hostname.endswith(".linkedin.com"))
    ):
        raise ValueError("LinkedIn URL must be a valid HTTPS LinkedIn URL")
    return value


class ContactCreate(BaseModel):
    company_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=255, strict=True)
    title: str | None = Field(default=None, max_length=255, strict=True)
    email: str | None = Field(default=None, max_length=255, strict=True)
    linkedin_url: str | None = Field(default=None, max_length=1000, strict=True)
    relationship_type: ContactRelationshipType = "other"
    notes: str | None = Field(default=None, max_length=10_000, strict=True)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _trim_contact_required(value)

    @field_validator("title", "notes")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _trim_contact_optional(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return _validate_contact_email(value)

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin(cls, value: str | None) -> str | None:
        return _validate_linkedin_url(value)


class ContactUpdate(BaseModel):
    company_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255, strict=True)
    title: str | None = Field(default=None, max_length=255, strict=True)
    email: str | None = Field(default=None, max_length=255, strict=True)
    linkedin_url: str | None = Field(default=None, max_length=1000, strict=True)
    relationship_type: ContactRelationshipType | None = None
    notes: str | None = Field(default=None, max_length=10_000, strict=True)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "ContactUpdate":
        for field_name in ("name", "relationship_type"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return _trim_contact_required(value) if value is not None else None

    @field_validator("title", "notes")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _trim_contact_optional(value)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        return _validate_contact_email(value)

    @field_validator("linkedin_url")
    @classmethod
    def validate_linkedin(cls, value: str | None) -> str | None:
        return _validate_linkedin_url(value)


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    company_id: uuid.UUID | None
    name: str
    title: str | None
    email: str | None
    linkedin_url: str | None
    relationship_type: ContactRelationshipType
    notes: str | None
    created_at: datetime
    updated_at: datetime


class ParticipantCreate(BaseModel):
    contact_id: uuid.UUID
    role: ParticipantRole


class ParticipantUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: ParticipantRole


class ParticipantContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    title: str | None
    email: str | None
    linkedin_url: str | None
    relationship_type: ContactRelationshipType


class InterviewParticipantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    interview_id: uuid.UUID
    contact_id: uuid.UUID
    role: ParticipantRole
    created_at: datetime
    updated_at: datetime
    contact: ParticipantContactOut


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


def _bounded_text_list(values: list[str], max_item_length: int, field_name: str) -> list[str]:
    """Normalize generated text arrays and cap every individual item."""
    normalized: list[str] = []
    for value in values:
        value = value.strip()
        if not value:
            raise ValueError(f"{field_name} cannot contain blank items")
        if len(value) > max_item_length:
            raise ValueError(f"{field_name} items cannot exceed {max_item_length} characters")
        normalized.append(value)
    return normalized


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


class PrepPriority(BaseModel):
    title: str = Field(max_length=255)
    reason: str = Field(max_length=2000)
    recommended_action: str = Field(max_length=2000)
    priority: Literal["high", "medium", "low"]

    @field_validator("title", "reason", "recommended_action")
    @classmethod
    def non_empty_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Preparation fields cannot be blank")
        return value


class TechnicalTopic(BaseModel):
    topic: str = Field(max_length=255)
    reason: str = Field(max_length=2000)
    recommended_actions: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("topic", "reason")
    @classmethod
    def non_empty_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Technical topic fields cannot be blank")
        return value

    @field_validator("recommended_actions")
    @classmethod
    def bounded_actions(cls, values: list[str]) -> list[str]:
        return _bounded_text_list(values, 1000, "Recommended actions")


class BehavioralStory(BaseModel):
    story_or_evidence: str = Field(max_length=2000)
    relevance: str = Field(max_length=2000)
    suggested_angle: str = Field(max_length=2000)

    @field_validator("story_or_evidence", "relevance", "suggested_angle")
    @classmethod
    def non_empty_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Behavioral story fields cannot be blank")
        return value


class LikelyQuestion(BaseModel):
    question: str = Field(max_length=2000)
    category: QuestionCategory = "technical"
    reason: str = Field(max_length=2000)
    recommended_angle: str = Field(max_length=2000)

    @field_validator("question", "reason", "recommended_angle")
    @classmethod
    def non_empty_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Likely question fields cannot be blank")
        return value


class GapWarning(BaseModel):
    area: str = Field(max_length=255)
    reason: str = Field(max_length=2000)
    suggested_action: str = Field(max_length=2000)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("area", "reason", "suggested_action")
    @classmethod
    def non_empty_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Gap warning fields cannot be blank")
        return value


class ReadinessBreakdown(BaseModel):
    technical_depth: int | None = Field(default=None, ge=0, le=100)
    role_context: int | None = Field(default=None, ge=0, le=100)
    behavioral_examples: int | None = Field(default=None, ge=0, le=100)
    logistics_and_preparation: int | None = Field(default=None, ge=0, le=100)


class ReadinessAssessment(BaseModel):
    score: int | None = Field(default=None, ge=0, le=100)
    summary: str = Field(max_length=2000)
    breakdown: ReadinessBreakdown = Field(default_factory=ReadinessBreakdown)
    limitations: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("summary")
    @classmethod
    def non_empty_summary(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Readiness summary cannot be blank")
        return value

    @field_validator("limitations")
    @classmethod
    def bounded_limitations(cls, values: list[str]) -> list[str]:
        return _bounded_text_list(values, 1000, "Limitations")


class InterviewPrepOutput(BaseModel):
    summary: str = Field(max_length=3000)
    preparation_priorities: list[PrepPriority] = Field(default_factory=list, max_length=20)
    technical_topics: list[TechnicalTopic] = Field(default_factory=list, max_length=20)
    behavioral_stories: list[BehavioralStory] = Field(default_factory=list, max_length=20)
    likely_questions: list[LikelyQuestion] = Field(default_factory=list, max_length=30)
    questions_to_ask: list[str] = Field(default_factory=list, max_length=20)
    gap_warnings: list[GapWarning] = Field(default_factory=list, max_length=20)
    limitations_or_uncertainties: list[str] = Field(default_factory=list, max_length=20)
    readiness: ReadinessAssessment

    @field_validator("summary")
    @classmethod
    def non_empty_summary(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Summary cannot be blank")
        return value

    @field_validator("questions_to_ask", "limitations_or_uncertainties")
    @classmethod
    def bounded_text_lists(cls, values: list[str]) -> list[str]:
        return _bounded_text_list(values, 1000, "Text list")


class GroundedObservation(BaseModel):
    observation: str = Field(min_length=1, max_length=1000)
    source_reference: Literal[
        "interview_notes",
        "question",
        "answer_notes",
        "reflection",
        "interview_result",
    ]
    evidence_summary: str = Field(min_length=1, max_length=1000)
    confidence: float | None = Field(default=None, ge=0, le=1)


class Insight(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    explanation: str = Field(min_length=1, max_length=1000)
    evidence_summary: str = Field(min_length=1, max_length=1000)
    confidence: float | None = Field(default=None, ge=0, le=1)


class GrowthArea(BaseModel):
    area: str = Field(min_length=1, max_length=200)
    rationale: str = Field(min_length=1, max_length=1000)
    suggested_action: str = Field(min_length=1, max_length=1000)
    confidence: float | None = Field(default=None, ge=0, le=1)


class RecurringTopic(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    occurrence_context: str = Field(min_length=1, max_length=1000)
    confidence: float | None = Field(default=None, ge=0, le=1)

    @field_validator("occurrence_context")
    @classmethod
    def require_explicit_scope(cls, value: str) -> str:
        value = value.strip()
        normalized = value.casefold()
        if "this interview" not in normalized and "multiple interviews" not in normalized:
            raise ValueError("Occurrence context must state its interview scope")
        return value


class RecommendedAction(BaseModel):
    action: str = Field(min_length=1, max_length=1000)
    time_horizon: Literal["before_next_interview", "this_week", "ongoing"]
    rationale: str = Field(min_length=1, max_length=1000)
    related_topics: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("related_topics")
    @classmethod
    def bounded_related_topics(cls, values: list[str]) -> list[str]:
        return _bounded_text_list(values, 200, "Related topics")


class AnalysisScope(BaseModel):
    interviews_considered: int = Field(ge=1, le=20)
    questions_considered: int = Field(ge=0, le=50)
    notes_available: bool
    result_recorded: bool
    data_limitations: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("data_limitations")
    @classmethod
    def bounded_data_limitations(cls, values: list[str]) -> list[str]:
        return _bounded_text_list(values, 1000, "Data limitations")


class InterviewOutcomeAnalysisOutput(BaseModel):
    grounded_observations: list[GroundedObservation] = Field(default_factory=list, max_length=30)
    possible_strengths: list[Insight] = Field(default_factory=list, max_length=20)
    possible_growth_areas: list[GrowthArea] = Field(default_factory=list, max_length=20)
    recurring_topics: list[RecurringTopic] = Field(default_factory=list, max_length=20)
    recommended_actions: list[RecommendedAction] = Field(default_factory=list, max_length=20)
    suggested_follow_up_points: list[str] = Field(default_factory=list, max_length=20)
    uncertainty_notes: list[str] = Field(default_factory=list, max_length=20)
    limitations: list[str] = Field(min_length=1, max_length=20)
    analysis_scope: AnalysisScope

    @field_validator("suggested_follow_up_points", "uncertainty_notes", "limitations")
    @classmethod
    def bounded_text_lists(cls, values: list[str]) -> list[str]:
        return _bounded_text_list(values, 1000, "Outcome analysis text")

    @field_validator("limitations")
    @classmethod
    def require_decision_limitation(cls, values: list[str]) -> list[str]:
        normalized = " ".join(values).casefold()
        if not (
            "based on user-recorded information" in normalized
            and "does not determine employer decision-making" in normalized
        ):
            raise ValueError(
                "Limitations must state that analysis is based on user-recorded "
                "information and does not determine employer decision-making"
            )
        return values


AISuggestionStatus = Literal[
    "pending",
    "accepted",
    "rejected",
    "edited",
    "expired",
    "failed",
    "superseded",
]


class AISuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    interview_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID | None
    suggestion_type: str
    proposed_value: InterviewPrepOutput | InterviewOutcomeAnalysisOutput
    confidence: float | None
    rationale: str | None
    model_provider: str
    model_version: str
    prompt_version: str
    output_schema_version: str
    input_snapshot_hash: str
    status: AISuggestionStatus
    resolved_value: InterviewPrepOutput | InterviewOutcomeAnalysisOutput | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class InterviewPrepResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["accepted", "rejected", "edited"]
    resolved_value: InterviewPrepOutput | None = None

    @model_validator(mode="after")
    def validate_resolution(self) -> "InterviewPrepResolveRequest":
        if self.status == "edited" and self.resolved_value is None:
            raise ValueError("resolved_value is required when status is 'edited'")
        return self


class InterviewOutcomeResolveRequest(BaseModel):
    status: Literal["accepted", "rejected", "edited"]
    resolved_value: InterviewOutcomeAnalysisOutput | None = None

    @model_validator(mode="after")
    def validate_resolution(self) -> "InterviewOutcomeResolveRequest":
        if self.status == "edited" and self.resolved_value is None:
            raise ValueError("resolved_value is required when status is 'edited'")
        return self


FollowUpType = Literal[
    "thank_you",
    "status_check",
    "recruiter_reply",
    "preparation",
    "custom",
]


def _validate_follow_up_title(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Title cannot be blank")
    return value


def _validate_follow_up_notes(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _validate_iana_timezone(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Timezone cannot be blank")
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise ValueError("Timezone must be a valid IANA timezone") from error
    return value


def _normalize_aware_utc(value: datetime | None, field_name: str) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be a timezone-aware datetime")
    return value.astimezone(timezone.utc)


class FollowUpCreate(BaseModel):
    interview_id: uuid.UUID | None = None
    type: FollowUpType
    title: str = Field(min_length=1, max_length=255, strict=True)
    due_at_utc: datetime
    timezone: str = Field(min_length=1, max_length=100, strict=True)
    completed_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=10_000, strict=True)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _validate_follow_up_title(value)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return _validate_follow_up_notes(value)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        return _validate_iana_timezone(value)

    @field_validator("due_at_utc")
    @classmethod
    def validate_due_at(cls, value: datetime) -> datetime:
        normalized = _normalize_aware_utc(value, "due_at_utc")
        assert normalized is not None
        return normalized

    @field_validator("completed_at")
    @classmethod
    def validate_completed_at(cls, value: datetime | None) -> datetime | None:
        return _normalize_aware_utc(value, "completed_at")


class FollowUpUpdate(BaseModel):
    interview_id: uuid.UUID | None = None
    type: FollowUpType | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255, strict=True)
    due_at_utc: datetime | None = None
    timezone: str | None = Field(default=None, min_length=1, max_length=100, strict=True)
    completed_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=10_000, strict=True)

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "FollowUpUpdate":
        for field_name in ("type", "title", "due_at_utc", "timezone"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return _validate_follow_up_title(value) if value is not None else None

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str | None) -> str | None:
        return _validate_follow_up_notes(value)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        return _validate_iana_timezone(value) if value is not None else None

    @field_validator("due_at_utc")
    @classmethod
    def validate_due_at(cls, value: datetime | None) -> datetime | None:
        return _normalize_aware_utc(value, "due_at_utc")

    @field_validator("completed_at")
    @classmethod
    def validate_completed_at(cls, value: datetime | None) -> datetime | None:
        return _normalize_aware_utc(value, "completed_at")


class FollowUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    application_id: uuid.UUID
    interview_id: uuid.UUID | None
    type: FollowUpType
    title: str
    due_at_utc: datetime
    timezone: str
    completed_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
