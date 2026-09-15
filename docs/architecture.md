# CareerNeed Architecture — v0.1

> Status: Active  
> Last updated: 2026-09-15  
> Scope: Current V1 architecture and the principles that guide future changes.

## 1. System overview

```text
┌──────────────────────┐
│   Next.js Web App    │
│  Dashboard / UI      │
└──────────┬───────────┘
           │ HTTPS / JSON
           ▼
┌──────────────────────┐
│     FastAPI API      │
│  Validation / Logic  │
│  Scoring / Queries   │
└──────────┬───────────┘
           │ SQLAlchemy / SQL
           ▼
┌──────────────────────┐
│      PostgreSQL      │
│ Jobs / Resumes /     │
│ Applications/Sources │
└──────────────────────┘
           ▲
           │ Persist normalized jobs
┌──────────┴───────────┐
│ Python Ingestion     │
│ Worker / Sync Jobs   │
└──────────┬───────────┘
           ▲
           │ Public job-board payloads
┌──────────┴───────────┐
│ Greenhouse / Lever   │
│ Ashby / future ATS   │
└──────────────────────┘
```

CareerNeed is a job-search workspace. It allows a user to keep discovered opportunities, manually found roles, resume data, application progress, notes, follow-up work, and application-specific contacts in a single system.

The current system deliberately separates:

- User experience and browser interaction.
- API validation and business logic.
- Persistent storage.
- External source ingestion.
- Optional scoring and later AI-assisted features.

## 2. Core principles

### 2.1 Modular job-source connectors

Every external job source must be implemented through a connector interface.

Examples:

```text
GreenhouseConnector
LeverConnector
AshbyConnector
CustomConnector
```

A connector is responsible for:

1. Fetching raw source data.
2. Handling source-specific pagination and request behavior.
3. Mapping raw source records into a normalized internal job shape.
4. Returning deterministic, testable results.
5. Reporting source-specific failures without breaking unrelated sources.

The API, database, and frontend must not depend directly on vendor-specific raw payload formats.

### 2.2 Normalize before persistence

Raw Greenhouse, Lever, Ashby, custom, and manual input must be converted into a shared job representation before database persistence.

At minimum, normalized job data should define:

```text
company_name
source
source_type
external_job_id
title
location
workplace_type
description
application_url
source_url
posted_at
first_seen_at
```

Rules:

- Store source identity and external job identity needed for idempotency.
- Normalize known workplace values to a controlled vocabulary.
- Preserve original source URL when available.
- Keep optional source data optional; do not manufacture missing facts.
- Use `source="manual"` and `source_type="manual_user_entry"` for user-entered jobs.
- Normalize before calculating any match score.

### 2.3 Idempotent ingestion

Job ingestion must be safe to run repeatedly.

A repeated sync must update or preserve an existing job rather than creating duplicate jobs when the same source job is encountered again.

The preferred identity is:

```text
source + external_job_id
```

If a source cannot provide a stable external ID, use a documented fallback identity strategy. That fallback must minimize accidental duplicates and be tested.

A sync should be safe when:

```text
Run 1 → creates a job
Run 2 with the same source job → updates or leaves the same job unchanged
Run 3 after source metadata changes → updates the existing job
```

### 2.4 Deterministic data before AI

CareerNeed prioritizes trustworthy source data and user-controlled evidence before AI features.

The order is:

```text
Verified source data
→ normalized jobs
→ user resume evidence
→ deterministic matching/scoring
→ explainable improvements
→ optional AI assistance
```

AI must not replace core data collection, data validation, user judgment, or application tracking.

Before an AI feature is introduced, define:

- The user workflow it improves.
- The source data and user data it may access.
- Expected output format.
- Error and uncertainty behavior.
- How users can verify or override its recommendation.
- Cost, privacy, and operational limits.

### 2.5 No automated application submission

CareerNeed does not automatically submit applications to third-party job sites.

The application flow is:

```text
Discover job
→ Save or mark as Applied in CareerNeed
→ Open application URL
→ User submits through the employer or job-board flow
→ User tracks status, notes, and follow-up in CareerNeed
```

This protects user control, avoids fragile site automation, and keeps the product focused on discovery and organization.

## 3. Application layers

### 3.1 Next.js web application

The Next.js application is responsible for:

- Rendering Home, To Do, Resumes, Jobs, Applications, Sources, and manual job-entry pages.
- Calling FastAPI endpoints.
- Maintaining browser-visible filter and pagination state through URL query parameters.
- Displaying loading, success, empty, and error states.
- Providing shared navigation and theme controls.
- Supporting Light, Dark, and System theme modes.
- Enforcing the frontend design-system conventions in `docs/PROJECT_CONVENTIONS.md`.

The frontend must not:

- Directly access PostgreSQL.
- Persist external source credentials in client-side code.
- Duplicate source normalization logic.
- Decide server-side application status transitions without API validation.
- silently discard user-entered information.

### 3.2 FastAPI API

The FastAPI API is responsible for:

- Request validation through Pydantic schemas.
- Business rules and state transitions.
- Query filtering, sorting, and pagination.
- Resume, job, application, application-contact, and source resource access.
- Manual job creation through `POST /jobs/manual`.
- Match-score calculation according to the active scoring policy.
- Returning stable API response shapes and HTTP status codes.
- Protecting future authenticated user data and source configuration.

The API must follow `docs/PROJECT_CONVENTIONS.md`, especially API naming, response, pagination, and error conventions.

### 3.3 PostgreSQL

PostgreSQL is the persistent source of truth for:

```text
jobs
applications
application_contacts
resumes
companies / sources
future interviews
future user preferences
```

Database responsibilities:

- Enforce unique identifiers and appropriate constraints.
- Preserve source identity required for idempotent ingestion.
- Maintain foreign-key relationships.
- Store timestamps in a consistent timezone-aware format.
- Use reviewed Alembic migrations for schema changes.
- Review every autogenerated migration before applying it; migrations must not contain unrelated destructive operations such as unexpected `drop_index`, `drop_table`, or data changes.
- Avoid deleting user history accidentally when source data changes.

### 3.4 Python ingestion worker

The ingestion worker is responsible for collecting public jobs from configured company sources and persisting normalized results.

Responsibilities:

1. Load active configured sources.
2. Select the appropriate connector.
3. Fetch public job-board data.
4. Normalize each raw job.
5. Upsert jobs idempotently.
6. Record source errors and sync metadata.
7. Continue syncing unrelated sources if one source fails.
8. Provide deterministic behavior that can be tested with fixtures.

The worker must not:

- Control the browser UI.
- Create or submit applications.
- Depend on frontend-only state.
- Store raw vendor payloads as the primary application data model unless there is a documented audit/debugging need.

## 4. Data model boundaries

### 4.1 Job

A Job represents an opportunity in the unified pool, whether it came from an ATS sync or manual user entry.

Typical fields:

```text
id
company_name
source
source_type
external_job_id
title
location
workplace_type
description
application_url
source_url
status
match_score
posted_at
first_seen_at
```

Important distinctions:

- `source` describes where CareerNeed obtained the job, such as `greenhouse`, `lever`, `ashby`, or `manual`.
- `source_type` provides a more precise ingestion/manual classification.
- `application_url` is the user-facing link used to apply.
- `source_url` is the original page where a job was discovered, when distinct.
- A job being in the pool does not automatically mean the user applied.

### 4.2 Application

An Application represents the user’s tracking relationship to a job.

Typical fields:

```text
id
user_id
job_id
resume_id
status
applied_at
notes
follow_up_on
created_at
updated_at
```

Application status is user-controlled and should use a stable controlled vocabulary:

```text
saved
applied
interviewing
offer
rejected
withdrawn
```

A user may save a job before applying. A manual job may be created with a default Job status of `saved`, but this must not be confused with a completed external application.

### 4.3 ApplicationContact

An ApplicationContact represents a person relevant to one tracked application, such as a recruiter, hiring manager, interviewer, referral, or other professional contact.

Typical fields:

```text
id
application_id
name
contact_type
email
linkedin_url
notes
created_at
updated_at
```

Database contract:

- `application_contacts.application_id` references `applications.id`.
- The foreign key uses `ON DELETE CASCADE`, so deleting an Application also deletes its contacts.
- `application_contacts.application_id` is indexed as `ix_application_contacts_application_id`.
- The table was introduced by Alembic revision `410b2482f2b7`.
- Contacts are reached through application-scoped API routes rather than as an unscoped top-level resource.

### 4.4 Resume

A Resume represents a user-managed resume record and its extracted evidence.

Typical fields:

```text
id
filename
label
skills
is_default
archived
created_at
updated_at
```

Resume parsing, extraction, and match scoring should remain explainable and should not claim facts absent from the uploaded/user-provided resume.

### 4.5 Company/source configuration

A source configuration represents a target company or job-board source used by the ingestion worker.

Typical fields:

```text
id
name
source_type
board_token
careers_url
priority
active
created_at
updated_at
```

Source credentials and configuration must remain server-side. Never expose tokens in the web client.

## 5. Data flows

### 5.1 Synced job flow

```text
Configured company source
→ ingestion worker selects connector
→ fetch public ATS jobs
→ normalize source payload
→ idempotent database upsert
→ FastAPI GET /jobs
→ Next.js Jobs page
→ user saves/tracks role
→ Application record, notes, follow-up, contacts
```

### 5.2 Manual job flow

```text
User finds a job externally
→ Next.js /jobs/add form
→ POST /jobs/manual
→ FastAPI validation
→ create normalized job with source=manual
→ calculate deterministic match score
→ persist Job
→ return 201 Created
→ redirect user to /jobs?source=manual
```

The manual job form must contain only fields the backend accepts and handles intentionally. If a field is accepted by the API but not persisted or transformed, fix the API contract before exposing that field to users.

### 5.3 Application tracking flow

```text
Job in unified pool
→ user marks Saved / Applied / Interviewing / Offer / Rejected / Withdrawn
→ application state persisted
→ user adds notes
→ user sets follow-up date
→ user adds, edits, or removes application contacts
→ Applications and To Do pages surface follow-up work
```

## 6. API boundary rules

The API follows the conventions in `docs/PROJECT_CONVENTIONS.md`.

Key requirements:

```text
POST creation → 201 Created
GET success → 200 OK
DELETE without body → 204 No Content
Invalid schema input → 422 Unprocessable Entity
Missing resource → 404 Not Found
Business conflict → 409 Conflict
```

Use snake_case in JSON payloads:

```json
{
  \"company_name\": \"Example Labs\",
  \"title\": \"Backend Engineer\",
  \"workplace_type\": \"hybrid\",
  \"application_url\": \"[https://example.com/careers/backend-engineer](https://example.com/careers/backend-engineer)\"\n}
```

Public API schemas, frontend TypeScript types, API tests, and relevant documentation must change together when a contract changes.

## 7. Frontend boundaries

The shared AppHeader is the normal entry point for every page:

```text
CareerNeed → /
Home
To Do
Resumes
Jobs
Applications
Sources
Theme: System / Light / Dark
```

The global UI system is defined in:

```text
docs/PROJECT_CONVENTIONS.md
```

All ordinary UI must use semantic color and layout tokens:

```text
bg-background
text-foreground
bg-card
border-border
bg-muted
text-muted-foreground
bg-primary
text-primary-foreground
```

Do not introduce page-specific black/white/slate/indigo/purple visual systems for normal UI.

## 8. Reliability and operations

### Current expectations

- A failure in one external source should not prevent other sources from syncing.
- Repeated ingestion should not duplicate source jobs.
- The web UI should show useful errors when an API request fails.
- API health checks support local development and operational visibility.
- Source-specific errors should include enough context to debug without exposing secrets.

### Future improvements

- Scheduled ingestion with explicit run history.
- Structured logs and error monitoring.
- Retry policy with rate-limit awareness.
- Source sync timestamps and source-health visibility in the UI.
- Background-task queue, if synchronous ingestion becomes too slow.
- Authentication and per-user data isolation.
- Database backup, retention, and recovery policy.
- Rate limiting and abuse protection for public-facing deployments.

## 9. Security and privacy

- Do not commit `.env` files, credentials, API keys, source tokens, or user resume content.
- Keep source configuration and future authentication secrets server-side.
- Validate and sanitize all external input at API boundaries.
- Treat resumes, application notes, follow-up information, and contact details as sensitive user data.
- Do not send user data to an AI provider without a documented feature, disclosure, and user-control strategy.
- Do not automatically submit applications or act on external job sites for users.

## 10. Change-management rules

Architecture changes require a deliberate plan when they affect:

- Database schema or migrations.
- API response/request contract.
- Source connector normalization.
- Idempotency identity strategy.
- Application status model.
- Authentication or user-data isolation.
- Localization routing.
- AI data access or AI output behavior.

For ordinary frontend changes, follow the Definition of Done in:

```text
docs/PROJECT_CONVENTIONS.md
```

For backend changes, update tests and API documentation in the same change series.

## 11. Architecture decision log

Record important decisions here or in future ADR files.

### ADR-001: Use public ATS sources first

**Decision:** Use public Greenhouse, Lever, Ashby, and similar source connectors for job discovery.

**Why:** Public board APIs are more stable and transparent than automating arbitrary job-site browsing.

### ADR-002: Normalize before persistence

**Decision:** Convert source-specific payloads to a shared internal Job model before saving.

**Why:** This isolates vendor differences and keeps Jobs, Applications, filtering, and scoring consistent.

### ADR-003: Source plus external ID for idempotency

**Decision:** Identify synced jobs primarily by `source + external_job_id`.

**Why:** Repeated worker runs must not duplicate the same job.

### ADR-004: Manual jobs enter the same pool

**Decision:** Manually entered opportunities are Jobs with `source=\"manual\"`.

**Why:** Users should be able to search, score, save, and track manually discovered jobs together with synced roles.

### ADR-005: No automated application submission

**Decision:** CareerNeed links users to the real application URL but does not submit applications on their behalf.

**Why:** Preserve user control, reduce automation fragility, and keep the product focused on job-search organization.
