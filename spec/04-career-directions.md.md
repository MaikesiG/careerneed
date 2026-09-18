# CareerNeed Specification: Career Directions

> **Version:** 1.1  
> **Status:** Approved with V2 Architecture Amendments  
> **Target Release:** Phase 2B — Architecture Elevation  
> **Owner:** CareerNeed Product and Platform  
> **Core Principle:** _Users do not search for jobs in a vacuum. Users discover, evaluate, save, and apply to jobs through the lens of a specific Career Direction._

---

## 1. Executive Summary

### 1.1 Problem Statement

The early CareerNeed prototype used a flat, user-wide workflow:

```text
User
  → One default resume
  → Global Jobs List with transient filters
  → Applications
```

This structure fails as the product grows.

| Legacy limitation                                                 | Product consequence                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| One global/default resume                                         | A user targeting different career paths repeatedly swaps resumes and loses context                        |
| Transient Jobs filters                                            | Intent is lost between sessions and cannot reliably drive recommendations                                 |
| Role and seniority assumptions shaped around software engineering | Data, Product, Design, Sales, Marketing, Finance, Operations, and other careers are second-class citizens |
| Match score attached to a Job                                     | The same role cannot be evaluated differently for different candidate goals and resumes                   |
| No direction lifecycle                                            | Users cannot pause one search path while actively pursuing another                                        |
| No historical context snapshot                                    | Later changes to a direction or resume distort past application analysis                                  |

### 1.2 Elevated Paradigm

A Career Direction is a first-class, user-owned representation of an intentional job-search path.

```text
User
└── Candidate Profile
    └── Career Directions (1:N)
        ├── Target roles
        ├── Seniority preferences
        ├── Location and work-model preferences
        ├── Compensation preferences
        ├── Exclusions and hard constraints
        ├── Preferred resume
        ├── Matching configuration
        └── Lifecycle: active / paused / archived
```

Examples:

```text
Full Stack Engineering       active
Frontend Engineering         active
Data Analytics               paused
Product Management           archived
```

Every downstream workflow may use a Career Direction as context:

```text
Job discovery
Job matching
Saved/dismissed job states
Resume recommendation
Application creation
Interview preparation
Follow-up recommendations
Outcome and career analytics
```

### 1.3 Boundary of This Spec

Career Direction represents **intent**, not the entire candidate identity.

```text
Candidate Profile = What the candidate can do
Career Direction  = What the candidate wants to pursue
Resume            = How the candidate presents relevant evidence
Job               = A market opportunity
Match Result      = The relationship between a Job and Direction context
Application       = A real user decision/action
Interview         = A specific interview event and its learning history
```

A Career Direction must never overwrite, duplicate, or hide the user’s Candidate Profile capabilities.

---

## 2. Product Rules

### 2.1 Career Direction Lifecycle

A direction uses a lifecycle rather than an `is_active` Boolean:

```text
active
paused
archived
```

| Status     | Meaning                       | Included in default Jobs discovery | Eligible for new automatic matches | Historical applications and matches |
| ---------- | ----------------------------- | ---------------------------------: | ---------------------------------: | ----------------------------------: |
| `active`   | Current job-search focus      |                                Yes |                                Yes |                            Retained |
| `paused`   | Temporarily not being pursued |                                 No |                                 No |                            Retained |
| `archived` | Historical or retired goal    |                                 No |                                 No |                            Retained |

Rules:

- A paused direction remains editable and can be reactivated.
- An archived direction is retained for historical context and can be restored according to product policy.
- An archived direction must not be physically deleted while referenced by an Application, Match Result, Resume, Event, or other historical record.
- `status` replaces `is_active`; do not store both fields.

### 2.2 Default Direction

A user may have **at most one** default Career Direction.

Rules:

- The default direction must have `status = active`.
- Paused and archived directions cannot become default.
- Setting one direction as default clears the prior default in the same database transaction.
- New users may temporarily have no default direction until onboarding is completed.
- Archiving or pausing the current default direction requires the user to select another active default direction or explicitly leave the account without one.

### 2.3 Active Direction Limit

The number of active Career Directions is a product and entitlement policy, not a database constraint.

Initial development configuration:

```text
MAX_ACTIVE_CAREER_DIRECTIONS=5
```

Future entitlement example:

```text
Free: 2 active directions
Pro: 5 active directions or unlimited
Coach/Team: policy controlled
```

Rules:

- Creation and activation must both enforce the active-direction limit.
- Pausing or archiving a direction frees an active slot.
- The database retains all paused and archived directions.

### 2.4 Direction Name Uniqueness

Direction names must be unique for the same user among non-deleted records.

Examples:

```text
Allowed across different users:
User A → Full Stack Engineering
User B → Full Stack Engineering

Not allowed for one user:
Full Stack Engineering
Full Stack Engineering
```

The API should normalize names by trimming surrounding whitespace. Case-insensitive uniqueness is recommended for a later migration if PostgreSQL `citext` or a normalized-name column is adopted.

### 2.5 Candidate Profile Separation

A candidate can have skills outside a specific career target.

```text
Candidate Profile:
React, TypeScript, AWS, Python, SQL

Career Direction A:
Full Stack Engineer

Career Direction B:
Data Analyst
```

Selecting Direction B does not remove React or AWS from the Candidate Profile. The matching engine may weigh profile evidence differently for each direction, but the profile stays durable and complete.

---

## 3. Universal Career Taxonomy

### 3.1 Universal Seniority Levels

CareerNeed uses a normalized seniority vocabulary that is discipline-agnostic.

```text
entry       New Grad, Intern, Associate, 0–1 years
junior      Junior, Level I, 1–2 years
mid         Professional, Level II, 2–5 years
senior      Senior, 5–8 years
lead        Lead, Tech Lead, domain lead
staff       Staff, strategic individual-contributor level
principal   Principal, Distinguished, Fellow, Architect
manager     First-line people manager
 director   Director, Senior Director
vp          Vice President
executive   C-Level, EVP, SVP, Founder
```

Exact years of experience are guidance, not hard validation. Titles and career ladders vary substantially by company, country, and discipline.

### 3.2 Illustrative Mapping Matrix

| Normalized level   | Software Engineering        | Data and Analytics          | Product and Design      | Sales and GTM              | Corporate and Finance        |
| ------------------ | --------------------------- | --------------------------- | ----------------------- | -------------------------- | ---------------------------- |
| `entry`            | New Grad SWE, Associate SWE | Junior Data Analyst         | Associate Designer      | BDR, SDR                   | Junior Financial Analyst     |
| `junior`           | SWE I                       | Data Analyst I              | Product Designer I      | Account Executive I        | Financial Analyst            |
| `mid`              | SWE II, Software Engineer   | Data Analyst II, BI Analyst | Product Designer II     | Account Executive II       | Senior Financial Analyst     |
| `senior`           | Senior SWE                  | Senior Data Analyst         | Senior Product Designer | Senior AE, Enterprise AE   | Finance Manager              |
| `lead`             | Tech Lead                   | Lead BI Analyst             | Lead Designer           | Sales Lead                 | Accounting Lead              |
| `staff`            | Staff SWE                   | Staff Data Scientist        | Staff Designer          | Strategic Account Director | Associate Director           |
| `principal`        | Principal SWE, Architect    | Principal Scientist         | Principal Designer      | Commercial Lead            | Finance Director             |
| `manager`          | Engineering Manager         | Data Analytics Manager      | Design Manager          | Sales Manager              | Corporate Controller         |
| `director`         | Director of Engineering     | Director of Data or BI      | Director of Design      | Director of Sales          | VP Finance equivalent varies |
| `vp` / `executive` | VP Engineering, CTO         | VP Data, Chief Data Officer | VP Design, CPO          | VP Sales, CRO              | CFO, Head of FP&A            |

### 3.3 Taxonomy Design Rules

- Career categories, canonical roles, role aliases, industries, seniority levels, and locations are platform-managed taxonomy data.
- User-supplied text may be retained as a custom target title or alias.
- `target_roles`, `seniority_levels`, and locations stored in JSONB are permitted only as an MVP storage representation; they are not the long-term taxonomy source of truth.
- Long-term matching must use normalized IDs and relation tables where reliable filtering, explanation, deduplication, and confidence handling matter.
- AI role classification must retain confidence, source, and user correction capability.

### 3.4 Career Categories

Initial validated categories:

```text
software_engineering
data_analytics
product
design
sales_gtm
marketing
finance
operations
customer_success
human_resources
other
```

Categories are not the same as target roles. For example:

```text
Category: data_analytics
Target roles: data_analyst, business_intelligence_analyst, product_analyst
```

---

## 4. Data Model

### 4.1 MVP Career Direction Entity

The initial database table intentionally supports rapid implementation while preserving a path to normalized relation tables.

```python
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.auth import utcnow
from app.database import Base


class CareerDirection(Base):
    __tablename__ = "career_directions"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "name",
            name="uq_career_directions_user_name",
        ),
        Index(
            "uq_career_directions_one_default_per_user",
            "user_id",
            unique=True,
            postgresql_where=text("is_default IS TRUE"),
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

    # Identity and presentation
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    color_token: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        default="indigo",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # MVP preference storage. Values must be normalized and validated by schemas/services.
    target_roles: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    seniority_levels: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    target_countries: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    locations: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)
    work_arrangements: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    exclusions: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)

    # Preferred presentation for new matching/application flows.
    default_resume_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resumes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Lifecycle and default selection.
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        index=True,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Soft deletion. Deleted records are excluded by normal reads.
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="career_directions")
    default_resume: Mapped["Resume | None"] = relationship(
        foreign_keys=[default_resume_id],
    )
    applications: Mapped[list["Application"]] = relationship(
        back_populates="career_direction",
    )
```

### 4.2 Allowed Values

The API/service layer must validate these values. A database `CHECK` constraint may be added in a later migration after values are stable.

```text
status:
active | paused | archived

work_arrangements:
remote | hybrid | onsite

seniority_levels:
entry | junior | mid | senior | lead | staff | principal | manager | director | vp | executive
```

`color_token` must be a semantic UI token from an allowlist:

```text
indigo
violet
blue
cyan
emerald
amber
rose
slate
```

Do not accept arbitrary CSS values, URL-like strings, or unvalidated custom values.

### 4.3 MVP JSON Shapes

#### Location item

```json
{
  "country_code": "US",
  "region_code": "US-NY",
  "city": "New York",
  "preference": "preferred"
}
```

Rules:

- `country_code` uses ISO 3166-1 alpha-2 where possible.
- `region_code` uses a canonical country subdivision format where available.
- `city` is optional.
- `preference` is one of `required`, `preferred`, or `acceptable`.

#### Exclusion item

```json
{
  "type": "keyword",
  "value": "security clearance required",
  "severity": "hard",
  "reason": "Not eligible for clearance-required roles"
}
```

Allowed exclusion types:

```text
company
industry
role
keyword
work_model
visa_policy
```

Allowed severities:

```text
hard
strong_preference
```

### 4.4 Normalized Long-Term Relation Model

The following tables are planned for the Job Catalog and Matching phases. They are not required for the initial Career Directions CRUD release, but the MVP JSON format must remain compatible with them.

```text
career_direction_roles
├── id
├── career_direction_id
├── role_id
├── priority                         primary | secondary
├── source_type                      user | ai_suggestion | import
├── confidence                       nullable
├── created_at
└── updated_at

career_direction_seniority_preferences
├── id
├── career_direction_id
├── seniority_level_id
├── preference                       target | acceptable
├── created_at
└── updated_at

career_direction_locations
├── id
├── career_direction_id
├── location_id
├── preference                       required | preferred | acceptable
├── created_at
└── updated_at

career_direction_work_arrangements
├── id
├── career_direction_id
├── arrangement                       remote | hybrid | onsite
├── preference                        required | preferred | acceptable
├── created_at
└── updated_at

career_direction_exclusions
├── id
├── career_direction_id
├── exclusion_type
├── value
├── severity
├── reason                           nullable
├── created_at
├── updated_at
└── deleted_at
```

### 4.5 Work Authorization Is Separate

Work authorization must not be stored inside `locations`, `target_countries`, or Career Direction preferences.

```text
Location preference:
Where the user wants to work

Work authorization:
Where the user is legally authorized to work
Whether sponsorship is needed
```

The future user-level model is:

```text
work_authorizations
├── id
├── user_id
├── country_code
├── authorization_type               citizen | permanent_resident | visa | other
├── sponsorship_requirement          not_required | may_require | required
├── expires_at                       nullable
├── notes                            nullable
├── created_at
├── updated_at
└── deleted_at
```

### 4.6 Entity Linkages

#### User

```python
career_directions: Mapped[list["CareerDirection"]] = relationship(
    back_populates="user",
    cascade="all, delete-orphan",
)
```

#### Resume

A Resume remains user-owned. A direction can designate one preferred Resume, but the API must validate ownership.

```text
CareerDirection.default_resume_id
→ Resume.id
```

Rules:

- The chosen Resume belongs to the authenticated user.
- The chosen Resume is not soft-deleted.
- Archived Resumes should not be selectable by default unless product policy explicitly allows it.
- This field is a preferred default for new flows, not a historical application record.

#### Application

Application may reference a direction, but must preserve historical context separately.

```text
applications
├── career_direction_id              nullable FK
├── career_direction_snapshot        nullable immutable JSONB
├── resume_version_id                nullable FK
├── resume_snapshot                  nullable immutable JSONB
├── job_match_result_id              nullable FK
└── match_snapshot                   nullable immutable JSONB
```

A foreign key alone is not sufficient because users can later rename, pause, archive, or modify a direction.

---

## 5. Matching Context Contract

Career Direction is one input to matching. It is not the only input and must not be treated as a replacement for Candidate Profile or Resume.

```text
Job
+ Candidate Profile snapshot
+ Career Direction snapshot
+ Work Authorization snapshot
+ Resume Version snapshot
+ Matching Configuration
+ Matching algorithm version
+ Taxonomy version
= Job Match Result
```

### 5.1 Match Result Principle

```text
Match Score ≠ Job property

Match Score = Job × Career Direction × Resume Version × Matching Context
```

Example:

```text
Google Software Engineer

Full Stack Engineering direction
→ Eligible
→ 91
→ Full Stack Resume v3

Frontend Engineering direction
→ Eligible
→ 86
→ Frontend Resume v2

Data Analytics direction
→ Not eligible or low relevance
```

### 5.2 Jobs Default Behavior

- Jobs discovery and recommendations use active Career Directions by default.
- A user may choose one direction as a focused Jobs context.
- Paused and archived directions are excluded from automatic recommendation/matching jobs.
- Historical matches remain visible when reviewing applications or career history.

### 5.3 Application Snapshot Requirement

When an Application is created from a Career Direction, persist an immutable snapshot including at least:

```json
{
  "direction_name": "Full Stack Engineering",
  "category": "software_engineering",
  "target_roles": ["full_stack_engineer", "frontend_engineer"],
  "seniority_levels": ["mid", "senior"],
  "locations": [
    {
      "country_code": "US",
      "region_code": "US-NY",
      "city": "New York",
      "preference": "preferred"
    }
  ],
  "work_arrangements": ["remote", "hybrid"],
  "snapshot_at": "2026-09-17T00:00:00+00:00"
}
```

This makes future historical analysis possible even when the current Career Direction changes.

---

## 6. API Specification

### 6.1 Route Prefix

Use the established API convention for the project. If routers are mounted under `/api`, use:

```text
/api/career-directions
```

If existing routers use direct prefixes such as `/auth`, preserve the project convention consistently and use:

```text
/career-directions
```

This spec writes `/api` in examples only when the application uses a global API prefix.

### 6.2 Routes

| Method   | Path                                                       | Description                                                               | Auth required |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------------------- | ------------: |
| `GET`    | `/api/taxonomy/career-roles`                               | Return curated roles, categories, role aliases, and seniority suggestions |           Yes |
| `GET`    | `/api/career-directions`                                   | List the authenticated user’s non-deleted directions                      |           Yes |
| `POST`   | `/api/career-directions`                                   | Create a Career Direction                                                 |           Yes |
| `GET`    | `/api/career-directions/{career_direction_id}`             | Retrieve one user-owned direction                                         |           Yes |
| `PATCH`  | `/api/career-directions/{career_direction_id}`             | Partially update one user-owned direction                                 |           Yes |
| `POST`   | `/api/career-directions/{career_direction_id}/set-default` | Set an active direction as the sole user default                          |           Yes |
| `POST`   | `/api/career-directions/{career_direction_id}/restore`     | Restore a soft-deleted/archived direction when allowed                    |           Yes |
| `DELETE` | `/api/career-directions/{career_direction_id}`             | Archive or soft-delete a direction; never cascade-delete applications     |           Yes |
| `GET`    | `/api/career-directions/{career_direction_id}/jobs`        | View jobs matched in the selected direction context                       |           Yes |

### 6.3 Static Route Ordering

Taxonomy routes must be registered before dynamic ID routes if they share a prefix. Prefer the separate taxonomy prefix shown above:

```text
/api/taxonomy/career-roles
```

Do not register this after a broad route such as:

```text
/api/career-directions/{career_direction_id}
```

A static path segment such as `taxonomy` can otherwise be interpreted as an ID by some routing configurations.

### 6.4 Ownership Rules

Every endpoint must derive ownership from the authenticated session user.

```python
current_user = get_current_user(...)
```

All resource queries must include the authenticated owner condition:

```python
select(CareerDirection).where(
    CareerDirection.id == career_direction_id,
    CareerDirection.user_id == current_user.id,
    CareerDirection.deleted_at.is_(None),
)
```

Rules:

- Ignore or reject any client-supplied `user_id`.
- Return a not-found style response for resources not owned by the caller where consistent with project policy.
- `default_resume_id` must belong to the authenticated user.
- A user cannot set another user’s Career Direction as default.
- A user cannot read, update, archive, restore, or list another user’s directions.

### 6.5 Create Rules

`POST /api/career-directions` must:

1. Require authenticated user identity.
2. Normalize and validate `name`.
3. Validate category, roles, seniority, location structures, work arrangements, color token, and exclusions.
4. Enforce the configured active-direction limit when status is `active`.
5. Validate `default_resume_id` ownership if supplied.
6. If `is_default = true`, enforce `status = active` and clear any old default transactionally.
7. Insert a direction with `deleted_at = null`.
8. Optionally create a Career Event after the event timeline module exists.

### 6.6 Update Rules

`PATCH /api/career-directions/{career_direction_id}` must:

- Accept partial fields only.
- Reject transitions to an invalid status.
- Enforce the active-direction limit when changing `paused`/`archived` to `active`.
- Prevent an archived or paused record from being default.
- Verify any new `default_resume_id` belongs to the current user.
- Preserve historical Applications and Match Results; do not rewrite their snapshots.
- Use a transaction if update affects default selection.

### 6.7 Set Default Rules

`POST /api/career-directions/{career_direction_id}/set-default` must run atomically:

```text
1. Confirm the direction belongs to current user.
2. Confirm deleted_at is null.
3. Confirm status is active.
4. Clear is_default on the user’s current default direction.
5. Set is_default = true on the requested direction.
6. Commit once.
```

The database partial unique index is the final protection against concurrent requests creating two defaults.

### 6.8 Archive and Restore Rules

`DELETE /api/career-directions/{career_direction_id}` is not a hard delete.

Initial product behavior:

```text
status = archived
```

Optional later soft-delete behavior:

```text
deleted_at = utcnow()
```

Rules:

- Archive does not delete Applications, Interviews, Follow-ups, Resume Versions, Match Results, or Events.
- If an archived direction was default, clear default or require selection of another active direction in the same transaction.
- Restore makes a direction eligible to become active again, subject to active-direction limits.
- Hard deletion is a future controlled retention task, not a normal API behavior.

---

## 7. Pydantic Schemas

The examples assume Pydantic v2.

```python
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


CareerCategory = Literal[
    "software_engineering",
    "data_analytics",
    "product",
    "design",
    "sales_gtm",
    "marketing",
    "finance",
    "operations",
    "customer_success",
    "human_resources",
    "other",
]

CareerDirectionStatus = Literal["active", "paused", "archived"]
WorkArrangement = Literal["remote", "hybrid", "onsite"]
LocationPreference = Literal["required", "preferred", "acceptable"]
ExclusionSeverity = Literal["hard", "strong_preference"]

SENIORITY_LEVELS = {
    "entry",
    "junior",
    "mid",
    "senior",
    "lead",
    "staff",
    "principal",
    "manager",
    "director",
    "vp",
    "executive",
}

COLOR_TOKENS = {
    "indigo",
    "violet",
    "blue",
    "cyan",
    "emerald",
    "amber",
    "rose",
    "slate",
}


class LocationItem(BaseModel):
    country_code: str = Field(min_length=2, max_length=2)
    region_code: str | None = Field(default=None, max_length=20)
    city: str | None = Field(default=None, max_length=100)
    preference: LocationPreference = "preferred"

    @field_validator("country_code")
    @classmethod
    def normalize_country_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("region_code", "city")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class DirectionExclusion(BaseModel):
    type: Literal["company", "industry", "role", "keyword", "work_model", "visa_policy"]
    value: str = Field(min_length=1, max_length=250)
    severity: ExclusionSeverity = "strong_preference"
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("value", "reason")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class CareerDirectionCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category: CareerCategory
    target_roles: list[str] = Field(min_length=1, max_length=20)
    seniority_levels: list[str] = Field(min_length=1, max_length=11)
    target_countries: list[str] = Field(default_factory=lambda: ["US"], max_length=30)
    locations: list[LocationItem] = Field(default_factory=list, max_length=50)
    work_arrangements: list[WorkArrangement] = Field(
        default_factory=lambda: ["remote", "hybrid", "onsite"],
        max_length=3,
    )
    exclusions: list[DirectionExclusion] = Field(default_factory=list, max_length=100)
    default_resume_id: uuid.UUID | None = None
    color_token: str | None = "indigo"
    description: str | None = Field(default=None, max_length=2000)
    status: CareerDirectionStatus = "active"
    is_default: bool = False

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("Name must contain at least 2 non-whitespace characters")
        return normalized

    @field_validator("target_roles")
    @classmethod
    def normalize_roles(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(role.strip().lower() for role in values if role.strip()))
        if not normalized:
            raise ValueError("At least one target role is required")
        return normalized

    @field_validator("seniority_levels")
    @classmethod
    def validate_seniority(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip().lower() for value in values if value.strip()))
        invalid = sorted(set(normalized) - SENIORITY_LEVELS)
        if invalid:
            raise ValueError(f"Invalid seniority levels: {', '.join(invalid)}")
        if not normalized:
            raise ValueError("At least one seniority level is required")
        return normalized

    @field_validator("target_countries")
    @classmethod
    def normalize_countries(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip().upper() for value in values if value.strip()))
        if not normalized:
            raise ValueError("At least one target country is required")
        return normalized

    @field_validator("work_arrangements")
    @classmethod
    def normalize_arrangements(cls, values: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(value.strip().lower() for value in values if value.strip()))
        if not normalized:
            raise ValueError("At least one work arrangement is required")
        return normalized

    @field_validator("color_token")
    @classmethod
    def validate_color_token(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in COLOR_TOKENS:
            raise ValueError("Unsupported color token")
        return normalized


class CareerDirectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    category: CareerCategory | None = None
    target_roles: list[str] | None = Field(default=None, min_length=1, max_length=20)
    seniority_levels: list[str] | None = Field(default=None, min_length=1, max_length=11)
    target_countries: list[str] | None = Field(default=None, max_length=30)
    locations: list[LocationItem] | None = Field(default=None, max_length=50)
    work_arrangements: list[WorkArrangement] | None = Field(default=None, max_length=3)
    exclusions: list[DirectionExclusion] | None = Field(default=None, max_length=100)
    default_resume_id: uuid.UUID | None = None
    color_token: str | None = None
    description: str | None = Field(default=None, max_length=2000)
    status: CareerDirectionStatus | None = None


class CareerDirectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    color_token: str | None
    description: str | None
    target_roles: list[str]
    seniority_levels: list[str]
    target_countries: list[str]
    locations: list[LocationItem]
    work_arrangements: list[str]
    exclusions: list[DirectionExclusion]
    default_resume_id: uuid.UUID | None
    default_resume_name: str | None = None
    status: str
    is_default: bool
    created_at: datetime
    updated_at: datetime
```

Implementation note: Share validation helpers between Create and Update so normalized values are applied consistently to any field supplied in `PATCH`.

---

## 8. Frontend Experience

### 8.1 Route

```text
/career-directions
```

The page is accessible from primary navigation, while preserving your existing design system’s compact controls, consistent content width, light/dark support, and low cognitive load.

### 8.2 Layout

Use a card-based management grid or compact responsive list.

Each card includes:

```text
Direction name
Category badge
Lifecycle badge or compact lifecycle control
Default indicator
Target role pills
Seniority preferences
Location and work arrangement summary
Preferred resume
Matching-job count when available
```

Primary actions:

```text
Edit settings
View matching jobs
Pause / resume
Archive
Set as default
```

Avoid exposing many equal-weight buttons at once. The main action for an active direction should be:

```text
View matching jobs
```

### 8.3 Empty State

New users without a direction see one clear primary action:

```text
Create your first career direction
```

Supportive copy should explain the concept plainly:

```text
A career direction saves the kinds of roles, locations, and work arrangements you want, so CareerNeed can organize matching jobs around your goals.
```

### 8.4 Creation Flow

Use a short modal or wizard.

```text
Step 1: Choose a broad track
Step 2: Add target roles
Step 3: Choose seniority preferences
Step 4: Choose locations and work arrangements
Step 5: Choose a preferred resume
Step 6: Review and create
```

Required initial fields:

```text
Name
Category
At least one target role
At least one seniority preference
```

Optional fields should not block first-time use:

```text
Specific city/region
Exclusions
Preferred resume
Description
```

### 8.5 Lifecycle UX

- Active directions are visible by default.
- Paused directions appear in a separate compact section or filterable state.
- Archived directions are hidden by default but recoverable from an archive view.
- Archiving must communicate that existing applications, interviews, and historical matches remain intact.
- The default indicator appears only on active directions.

### 8.6 Jobs Context

When the user chooses **View matching jobs**, navigate with explicit direction context, for example:

```text
/jobs?careerDirectionId=<uuid>
```

The Jobs page should show the active direction context clearly and provide a simple way to switch direction without resetting unrelated user filters unexpectedly.

---

## 9. Migration and Backfill Plan

### 9.1 Safety Rules

The migration must be additive and must not delete or recreate existing data.

Never use:

```python
Base.metadata.drop_all(...)
```

Never delete:

```text
users
password hashes
user sessions
password reset tokens
resumes
applications
interviews
existing job records
```

### 9.2 Alembic Migration Requirements

The migration creates:

```text
career_directions table
foreign keys to users and resumes
user-scoped unique direction name
partial unique index: at most one default direction per user
indexes for user_id, status, default_resume_id, deleted_at
```

Example PostgreSQL partial unique index intent:

```sql
CREATE UNIQUE INDEX uq_career_directions_one_default_per_user
ON career_directions (user_id)
WHERE is_default IS TRUE;
```

### 9.3 Existing User Backfill

Do not blindly create directions for every existing user during migration. This can create duplicate or meaningless defaults.

Approved backfill strategy:

1. Add the table and API without automatic migration-time seed records.
2. Existing users see the Career Directions empty state.
3. Offer onboarding to create their first direction.
4. Optionally run a controlled, idempotent backfill only for users meeting explicit criteria, such as a legacy saved target role/resume configuration.
5. Any backfill must check that the user does not already have a non-deleted direction before creating one.

### 9.4 Default Direction Index

The partial unique index enforces **at most one** default direction, not exactly one. This allows new users and users with only archived directions to have zero defaults safely.

---

## 10. Testing Requirements

### 10.1 API Authentication and Ownership

Tests must cover:

```text
Unauthenticated list/create/read/update/archive/set-default requests are rejected.
User A cannot list User B directions.
User A cannot retrieve User B direction by ID.
User A cannot update User B direction by ID.
User A cannot archive or restore User B direction by ID.
User A cannot set User B direction as default.
User A cannot attach User B resume as default_resume_id.
```

### 10.2 Lifecycle and Default Tests

```text
Creating an active direction succeeds below active limit.
Creating or reactivating beyond active limit fails clearly.
Paused and archived directions do not count as active.
Paused and archived directions cannot become default.
set-default clears the previous user default transactionally.
Database partial unique index prevents two defaults under concurrency.
Archiving the current default clears/requires replacement according to policy.
Archived directions remain linked to existing applications.
```

### 10.3 Validation Tests

```text
Name is trimmed and cannot be whitespace-only.
Category must be one of the supported values.
Target roles must be non-empty and deduplicated.
Seniority values must be valid normalized values.
Country codes are normalized to uppercase.
Work arrangements are valid and deduplicated.
Color token must be allowlisted.
Location/exclusion payloads match documented structures.
```

### 10.4 Historical Integrity Tests

```text
Updating a direction does not mutate existing application direction snapshots.
Changing the preferred resume does not mutate applications created with earlier resume versions.
Archiving a direction does not delete applications, interviews, follow-ups, or match results.
Soft-deleted directions are excluded from normal list queries.
```

### 10.5 Migration Tests

```text
Upgrade applies successfully to a database containing existing users/resumes/applications.
No existing authentication or application data is removed.
Unique default index behaves correctly.
Downgrade strategy is reviewed before use; production rollback should generally favor forward fixes.
```

---

## 11. Definition of Done

### Data Model and Migration

1. An Alembic migration creates `career_directions` with:
   - UUID primary key.
   - authenticated `user_id` ownership.
   - `status` values: `active`, `paused`, `archived`.
   - `is_default`.
   - `default_resume_id`.
   - timezone-aware timestamps using the project `utcnow()` helper.
   - `deleted_at` support for soft-delete evolution.
   - user-scoped unique direction name.
   - PostgreSQL partial unique index enforcing at most one default direction per user.

2. Direction preference values are validated and normalized.
   - MVP may store roles, seniority, locations, arrangements, and exclusions in JSONB.
   - JSONB is explicitly transitional and is not the permanent taxonomy source of truth.
   - Location values use canonical country/region conventions.
   - Work authorization remains a separate user-level model.

3. The migration is additive and does not remove users, password hashes, sessions, reset tokens, resumes, applications, interviews, or existing jobs.

### API and Authorization

4. FastAPI implements list, create, retrieve, PATCH update, archive, restore, set-default, taxonomy lookup, and direction-scoped jobs access.

5. Every endpoint enforces authenticated ownership.
   - Client-provided `user_id` is not trusted.
   - `default_resume_id` belongs to the current user.
   - paused/archived directions cannot be default.
   - active-direction limits are enforced through product configuration.

6. `set-default` is transactional and maintains at most one default direction per user.

7. Tests cover authentication, cross-user isolation, validation, name uniqueness, default uniqueness, lifecycle transitions, active limits, default resume ownership, and historical application integrity.

### Product Behavior

8. `/career-directions` lets users create, edit, pause, archive, restore, set default, assign a preferred resume, and open direction-scoped matching jobs.

9. Jobs discovery defaults use active directions only.

10. New Applications created in a Career Direction context store:
    - `career_direction_id`;
    - immutable Career Direction snapshot;
    - selected Resume Version;
    - immutable Resume snapshot or durable document reference;
    - current Match Result reference and/or immutable Match snapshot.

11. New-user onboarding may suggest a first direction. Database migrations must not blindly seed duplicate directions for existing users.

---

## 12. Deferred Work

The following are intentionally outside the first Career Directions implementation but must remain compatible with this model:

```text
Normalized taxonomy relation tables
Candidate Profile editor and resume parsing
Work authorization UI and matching enforcement
Matching configuration UI
Job Match Result generation and explanations
AI role/skill suggestion review workflow
Company and canonical-job data model
Job source ingestion and deduplication
Career event timeline
Resume Version snapshotting
Entitlement/pricing enforcement
Organization, coach, and delegation permissions
Calendar and email integrations
```

---

## 13. Implementation Order

```text
1. Confirm existing User, Resume, Application, database, router, and Alembic conventions.
2. Add CareerDirection model and User/Application relationships.
3. Create and manually review the additive Alembic migration.
4. Add Pydantic schemas and shared validators.
5. Implement authenticated CRUD, lifecycle, and default-direction transaction.
6. Add tests for ownership, constraints, and lifecycle behavior.
7. Build /career-directions UI.
8. Add direction context to Jobs navigation.
9. Add Application direction/resume snapshot behavior as part of the matching/application phase.
10. Replace transitional JSONB preferences with normalized relation tables only when taxonomy and matching require it.
```

---

## 14. Final Design Contract

Career Directions gives persistent structure to job-search intent without confusing it with candidate capability or historical activity.

```text
Candidate Profile
  What I can do

Career Direction
  What I want to pursue

Resume Version
  How I present relevant evidence

Job
  A market opportunity

Match Result
  How that job fits this direction and resume context

Application
  What I decided to do

Interview
  What happened and what I learned
```

This separation is mandatory for CareerNeed to support multiple career paths, reliable matching, explainable AI, correct historical analysis, and future expansion beyond a single job-search workflow.
