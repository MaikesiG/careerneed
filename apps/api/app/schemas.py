import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

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


class ApplicationJobStateMap(BaseModel):
    states: dict[str, ApplicationJobState]


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
