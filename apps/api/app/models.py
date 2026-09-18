import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)



class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    password_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    password_set_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    resumes: Mapped[list["Resume"]] = relationship(back_populates="user")
    applications: Mapped[list["Application"]] = relationship(back_populates="user")
    companies: Mapped[list["Company"]] = relationship(back_populates="user")
    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    password_reset_tokens: Mapped[list["PasswordResetToken"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    ai_suggestions: Mapped[list["AISuggestion"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Company(Base):
    __tablename__ = "companies"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "source_type",
            "board_token",
            name="uq_companies_user_source_type_board_token",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    board_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    careers_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="companies")
    jobs: Mapped[list["Job"]] = relationship(back_populates="company")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint("source", "external_job_id", name="uq_source_external_job_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="company_ats")
    external_job_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    workplace_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    application_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new")
    match_score: Mapped[int | None] = mapped_column(nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    company: Mapped["Company | None"] = relationship(back_populates="jobs")
    applications: Mapped[list["Application"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class Resume(Base):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_default: Mapped[bool] = mapped_column(default=False, index=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="resumes")
    applications: Mapped[list["Application"]] = relationship(back_populates="resume")


class Application(Base):
    __tablename__ = "applications"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "job_id",
            name="uq_applications_user_job",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(50), default="saved", index=True)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="applications")
    job: Mapped["Job"] = relationship(back_populates="applications")
    resume: Mapped["Resume | None"] = relationship(back_populates="applications")
    contacts: Mapped[list["ApplicationContact"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
    )
    interviews: Mapped[list["Interview"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="Interview.round",
    )


class ApplicationContact(Base):
    __tablename__ = "application_contacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_type: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    application: Mapped["Application"] = relationship(back_populates="contacts")


class LLMCredential(Base):
    __tablename__ = "llm_credentials"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_llm_credentials_user_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    encrypted_api_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    tokens_used: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        index=True,
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        UniqueConstraint(
            "token_hash",
            name="password_reset_tokens_token_hash_key",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")


class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    round: Mapped[int] = mapped_column(default=1)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    interview_type: Mapped[str] = mapped_column(String(50), nullable=False, default="technical")
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    duration_minutes: Mapped[int | None] = mapped_column(nullable=True, default=60)
    timezone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="scheduled", index=True)
    result: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    interviewer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    interviewer_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    interviewer_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    meeting_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    preparation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    application: Mapped["Application"] = relationship(back_populates="interviews")
    questions: Mapped[list["InterviewQuestion"]] = relationship(
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="InterviewQuestion.created_at",
    )
    ai_suggestions: Mapped[list["AISuggestion"]] = relationship(
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="AISuggestion.created_at.desc()",
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    __table_args__ = (
        Index("ix_interview_questions_interview_id_created_at", "interview_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="technical")
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    answer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reflection: Mapped[str | None] = mapped_column(Text, nullable=True)
    leetcode_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    asked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    interview: Mapped["Interview"] = relationship(back_populates="questions")


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"
    __table_args__ = (
        Index(
            "ix_ai_suggestions_user_interview_type_status_created",
            "user_id",
            "interview_id",
            "suggestion_type",
            "status",
            "created_at",
        ),
        Index(
            "ix_ai_suggestions_pending_idempotency",
            "interview_id",
            "suggestion_type",
            "input_snapshot_hash",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, default="interview")
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    suggestion_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    proposed_value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model_version: Mapped[str] = mapped_column(String(150), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(100), nullable=False)
    output_schema_version: Mapped[str] = mapped_column(String(50), nullable=False)
    input_snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    resolved_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped["User"] = relationship(back_populates="ai_suggestions")
    interview: Mapped["Interview"] = relationship(back_populates="ai_suggestions")


