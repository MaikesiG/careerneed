---
status: archived
superseded_by: ../06-architecture/system-boundaries-and-integration-principles.md
reason: Historical engineering conventions consolidated into architecture standards.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../06-architecture/system-boundaries-and-integration-principles.md](../06-architecture/system-boundaries-and-integration-principles.md).

# CareerNeed Engineering Conventions

> **Version:** 1.0  
> **Status:** Active  
> **Last Updated:** 2026-09-17  
> **Purpose:** Define product, frontend, backend, database, AI, security, reliability, documentation, and review conventions for CareerNeed. All new work must follow these rules.

---

## 1. Product and Architecture Alignment

CareerNeed is a privacy-first, AI-assisted career operating system.

All implementation must preserve the core domain model:

```text
Candidate Profile
  What the user can do
        ↓
Career Direction
  What the user wants to pursue
        ↓
Resume Version
  How the user presents relevant evidence
        ↓
Canonical Job
  What opportunity exists
        ↓
Match Result
  How the job fits this user’s direction/resume context
        ↓
Application
  What action the user took
        ↓
Interview
  What happened and what the user learned
        ↓
Follow-up / Today
  What needs attention next
```

### 1.1 Domain Rules

```text
Candidate Profile ≠ Career Direction
Candidate Profile ≠ Resume
Resume ≠ Resume Version
Job ≠ Job Source listing
Match Score ≠ Job property
Saved/Dismissed/Applied ≠ Job property
Application current state ≠ complete history
Follow-up ≠ Notification Delivery
AI output ≠ user-confirmed source of truth
```

### 1.2 Current Delivery Sequence

```text
Phase 1: Core Foundation
Status: completed with ongoing hardening

Phase 2A: Interviews, Follow-ups, and Today
Status: active implementation milestone

Phase 2B: Candidate Profile, Career Directions, Resume Versions, Work Authorization
Status: next domain foundation

Phase 2C: Company, Canonical Jobs, Job Sources, Location/Remote Scope
Status: catalog foundation

Phase 2D: Contextual Matching and Jobs Workspace V2
Status: decision-support foundation

Phase 3: AI Interview Assistance and Fast Capture
Phase 4: Career Intelligence and Longitudinal Insights
Phase 5: Notifications, Calendar, Browser Extension, and Integrations
```

Do not implement later-phase AI, scraping, notification, or integration behavior as production architecture before the required data model, ownership, privacy, and background-job contracts are in place.

---

## 2. Frontend Conventions

### 2.1 Design Principles

- Use one cohesive visual system across all pages.
- Support system, light, and dark themes.
- Use semantic design tokens instead of arbitrary hard-coded palette classes.
- Keep primary actions obvious and minimize cognitive overload.
- Preserve consistent content width, side margins, spacing, card surfaces, and interaction patterns.
- Use compact controls where appropriate, but do not compromise accessibility.
- Every screen must have clear loading, empty, success, and error states.
- Status must not be communicated by color alone.
- User-facing text should be direct, concise, and action-oriented.

### 2.2 Semantic Tailwind Tokens

Use semantic token classes whenever an equivalent exists.

| Purpose                 | Preferred classes                                          |
| ----------------------- | ---------------------------------------------------------- |
| Page background         | `bg-background`                                            |
| Primary text            | `text-foreground`                                          |
| Card/surface background | `bg-card`                                                  |
| Card text               | `text-card-foreground`                                     |
| Borders/dividers        | `border-border`                                            |
| Muted surface           | `bg-muted`                                                 |
| Secondary text          | `text-muted-foreground`                                    |
| Primary action          | `bg-primary text-primary-foreground`                       |
| Focus ring              | `focus-visible:ring-2 focus-visible:ring-primary/20`       |
| Destructive state       | `bg-destructive/10 text-destructive border-destructive/40` |

Avoid page-level palette choices such as:

```tsx
bg - slate - 900;
text - indigo - 600;
bg - purple - 500;
text - zinc - 400;
```

unless they are intentionally defined as semantic design tokens in the shared theme layer.

### 2.3 Semantic Status Styles

| Meaning                          | Example styling                                            |
| -------------------------------- | ---------------------------------------------------------- |
| Success / passed / completed     | `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400` |
| Warning / due today / attention  | `bg-amber-500/10 text-amber-600 dark:text-amber-400`       |
| Destructive / overdue / rejected | `bg-destructive/10 text-destructive`                       |
| Informational / scheduled        | `bg-sky-500/10 text-sky-600 dark:text-sky-400`             |
| Neutral / saved / archived       | `bg-muted text-muted-foreground`                           |

Status badges must include meaningful text:

```text
Scheduled
Completed
Overdue
Needs review
Not eligible
Archived
```

Do not rely on color alone.

### 2.4 Control Heights

Shared components must follow control-height tokens:

```css
--control-height-sm: 32px;
--control-height-md: 40px;
--control-height-lg: 44px;
--control-radius: 6px;
```

Default component rules:

```text
Button default: h-10 px-4 text-sm rounded-md
Input default: h-10 px-3 text-sm rounded-md
Select trigger: h-10 px-3 text-sm rounded-md
Combobox trigger: h-10
Search input: h-10
Filter trigger: h-10
Dense controls: h-8 only where intentional
Prominent modal submit action: h-11 where appropriate
```

Do not introduce arbitrary heights on individual pages.

### 2.5 Standard Page Layout

Default layout:

```tsx
<main className='min-h-screen bg-background px-4 py-10 text-foreground sm:px-6 lg:px-8'>
  <div className='mx-auto max-w-6xl'>{/* Page content */}</div>
</main>
```

Deviation is acceptable only where the layout requires it, such as the Jobs V2 desktop sidebar workspace or a full-width Pipeline Board. Preserve global side margins and responsive behavior.

### 2.6 Responsive Rules

```text
Desktop workspace breakpoint: lg / 1024px
Mobile layouts remain fully functional below lg
Do not maintain separate duplicated mobile/desktop page implementations
Prefer responsive grid/flex/container patterns
Use drawer/sheet patterns for dense filters on narrow screens
Use touch-safe targets for important mobile actions
```

### 2.7 Accessibility Rules

- All interactive elements must be keyboard accessible.
- Modal/dialog/drawer focus must be trapped while open and returned to its trigger when closed.
- Provide visible focus styles.
- Use labels for form inputs; placeholders are not labels.
- Use semantic button/link elements correctly.
- External links use:

```tsx
target = '_blank';
rel = 'noopener noreferrer';
```

- Clearly indicate when an external link opens a new tab.
- Use `aria-live`/status regions for meaningful async status updates where appropriate.
- Do not hide required interaction behind hover-only controls.
- Preserve accessible text for icon-only buttons through labels/tooltips.

### 2.8 Navigation Rules

- Use shared `AppHeader` on standard authenticated application pages.
- Use Next.js `<Link>` for normal navigation.
- Use `router.push()` only for imperative navigation after a user action or mutation.
- Preserve relevant filter/list state in URL query parameters.
- Do not overload Home or Today with excessive navigation cards.
- Home is the high-level navigation and welcome hub.
- Today is an action workspace focused on current tasks.

---

## 3. Route and URL Conventions

### 3.1 Web Routes

| Route                           | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `/`                             | Home workspace and high-level navigation                      |
| `/todo`                         | Today: overdue follow-ups, interviews today, upcoming actions |
| `/jobs`                         | Direction-aware Jobs discovery workspace                      |
| `/jobs/add`                     | Manual job-entry form                                         |
| `/applications`                 | Application List view                                         |
| `/applications/board`           | Pipeline Board view                                           |
| `/applications/[applicationId]` | Application detail workspace                                  |
| `/career-directions`            | Career Direction management                                   |
| `/resumes`                      | Resume and Resume Version management                          |
| `/sources`                      | Job source/provider configuration                             |
| `/profile`                      | Candidate Profile and work authorization                      |
| `/login`                        | Login                                                         |
| `/register`                     | Registration                                                  |
| `/forgot-password`              | Password-reset request                                        |
| `/reset-password`               | Password-reset completion                                     |
| `/settings`                     | User settings, AI/provider preferences, usage, notifications  |

### 3.2 URL Query State

List-page state that affects visible results must be serializable in URL query parameters.

Examples:

```text
/jobs?careerDirectionId=<uuid>
/jobs?provider=ashby&provider=greenhouse
/jobs?workplaceType=remote&workplaceType=hybrid
/jobs?jobState=saved&jobState=applied
/jobs?minMatchScore=80
/jobs?offset=25&limit=25
```

Rules:

```text
Direction defaults are distinct from temporary URL overrides.
Filter changes should update URL state.
Refreshing or sharing a URL should reproduce the visible query where permissions allow.
Do not include secrets, tokens, private document contents, or raw provider credentials in URLs.
```

---

## 4. Backend API Conventions

### 4.1 Core Rules

- Use resource-oriented REST endpoints.
- Use plural lowercase kebab-case route nouns.
- Use UUIDs for resource identifiers where the project model uses UUIDs.
- Use `snake_case` JSON request/response keys.
- Validate all incoming payloads with Pydantic.
- Return explicit response models; do not expose raw ORM models.
- Derive user identity from authenticated session dependencies.
- Never trust client-provided `user_id`.
- Validate parent ownership for nested resource routes.
- Return safe, consistent errors.
- Use timezone-aware timestamps.

### 4.2 Method Semantics

| Method   | Meaning                                              |
| -------- | ---------------------------------------------------- |
| `GET`    | Retrieve resource(s)                                 |
| `POST`   | Create a resource or execute a named business action |
| `PATCH`  | Partial update                                       |
| `PUT`    | Full replacement only                                |
| `DELETE` | Archive/soft delete by default                       |

Do not use `PUT` with a partial optional-field schema.

### 4.3 Route Naming

Preferred API convention:

```text
/api/auth
/api/career-directions
/api/jobs
/api/applications
/api/interviews
/api/follow-ups
/api/resumes
/api/taxonomy/career-roles
```

If the existing API intentionally uses direct prefixes such as `/auth`, preserve that convention consistently and document the difference. Do not mix `/api/*` and direct routes without a global routing policy.

### 4.4 Static Before Dynamic Routes

Register static routes before dynamic ID routes where prefixes overlap.

Preferred:

```text
GET /api/taxonomy/career-roles
GET /api/career-directions/{career_direction_id}
```

Avoid ambiguous ordering:

```text
GET /api/career-directions/{career_direction_id}
GET /api/career-directions/taxonomy/roles
```

### 4.5 HTTP Status Codes

```text
200 OK                  Successful retrieval/update
201 Created             Successful creation
202 Accepted            Async work accepted
204 No Content          Successful action with no response body
400 Bad Request         Invalid state/operation
401 Unauthorized        Missing or invalid authentication
403 Forbidden           Authenticated but prohibited when policy uses explicit denial
404 Not Found           Missing resource or ownership-hidden resource
409 Conflict            Uniqueness/idempotency/concurrency conflict
422 Unprocessable Entity Input validation failure
429 Too Many Requests   Rate-limit rejection
500 Internal Server Error Unexpected server failure
```

### 4.6 Error Shape

Use safe consistent errors:

```json
{
  "detail": "Human-readable safe message",
  "code": "optional_machine_readable_code"
}
```

Never return:

```text
Stack traces
Raw SQL errors
Database URLs
Credentials
Provider raw error payloads containing secrets
Detailed cross-user authorization information
```

### 4.7 Pagination

Initial standard uses offset pagination:

```text
GET /api/jobs?limit=25&offset=0
```

Response shape:

```json
{
  "total": 148,
  "limit": 25,
  "offset": 0,
  "items": []
}
```

Rules:

```text
Server enforces default and maximum page sizes.
Ordering must be stable and deterministic.
Total is server-authoritative.
Cursor pagination may replace offset pagination after measured scale/performance need.
```

### 4.8 Filtering

```text
Use documented repeated query parameters or a documented comma-separated form.
Choose one format consistently.
Validate filter values.
Return effective filters when defaults and overrides are resolved server-side.
```

### 4.9 Idempotency

Use `Idempotency-Key` for create/retry-sensitive workflows.

Required candidates:

```text
Application creation
Job source ingestion
Resume-import task enqueueing
AI task enqueueing
Notification delivery
External webhook processing
```

Repeated requests with the same valid key must not create duplicate business records.

### 4.10 Optimistic Concurrency

Critical mutable records should use:

```text
record_version
or
If-Match
```

On stale writes:

```text
Return 409 Conflict.
Do not silently overwrite a newer update.
```

Relevant entities:

```text
Applications
Career Directions
Resumes
Interviews
Follow-ups
Notification preferences
```

### 4.11 Pydantic v2 Responses

For ORM-backed responses:

```python
from pydantic import BaseModel, ConfigDict

class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
```

Response schemas must explicitly omit:

```text
password_hash
password-reset token hash
session token hash
provider credential ciphertext
raw provider secrets
internal-only fields
```

---

## 5. Database and Migration Conventions

### 5.1 ORM Model Rules

- Use SQLAlchemy typed mappings.
- Use UUID primary keys where the existing domain uses UUIDs.
- Use explicit foreign keys and indexes based on real query patterns.
- Use `DateTime(timezone=True)` for real timestamps.
- Use project `utcnow()` rather than `datetime.utcnow()`.
- Keep mutable source-of-truth data separate from historical snapshots.
- Use `deleted_at`/archive state for recoverable deletion where history matters.
- Avoid generic JSONB fields as permanent substitutes for stable relational concepts when filtering/joining/history requires normalization.

### 5.2 Snapshot Rules

Mutable source data and historical snapshots are different.

```text
Current Resume Version
≠ Resume snapshot used in Application

Current Career Direction
≠ Career Direction snapshot used in Application

Current Job/Company record
≠ Job/company/title/URL snapshot used in Application

Current Match Result
≠ Match context used at the time of application
```

Applications must retain relevant snapshots.

### 5.3 Migrations

All schema changes require version-controlled Alembic migrations.

Rules:

```text
Review auto-generated migration files.
Prefer additive migrations.
Back up before high-risk changes.
Test against representative data.
Never delete/recreate tables merely to evolve schema.
Never run drop_all() in normal app startup or deployment.
Verify target database before applying migration.
```

Safe migration sequence:

```text
Add nullable structure
→ deploy compatible reader
→ backfill safely
→ validate backfill
→ deploy new writer
→ add constraint/index
→ remove deprecated field after controlled period
```

### 5.4 Database Environments

Keep distinct configurations for:

```text
development
test
staging
production
```

Do not run test cleanup or reset scripts against development/staging/production databases.

### 5.5 Data Ownership

Every user-owned table must have a clear ownership route:

```text
Direct user_id
or
owner resolvable through parent resource with enforced ownership check
```

User-owned examples:

```text
Candidate Profile
Career Direction
Resume
Resume Version
Application
Interview
Contact
Interview Question
Follow-up
User Job State
Job Match Result
AI Suggestion
Notification
File
```

### 5.6 Global Catalog Data

Platform-managed catalog data includes:

```text
Company
Canonical Job
Job Source
Taxonomy
System matching templates
```

Normal users must not directly mutate global catalog records without controlled workflows.

---

## 6. Application Workflow Conventions

### 6.1 Application Statuses

Use the approved workflow vocabulary:

```text
saved
applied
screening
interview
offer
accepted
declined
rejected
withdrawn
on_hold
```

`offer` is not terminal. Final states include:

```text
accepted
declined
rejected
withdrawn
```

Status transitions must be validated by the service layer.

### 6.2 Event Timeline

Significant workflow changes create immutable events.

```text
application_created
application_status_changed
resume_selected
match_generated
interview_scheduled
interview_rescheduled
interview_completed
interview_cancelled
follow_up_created
follow_up_completed
```

When an action changes a current Application state:

```text
Validate ownership and transition
→ update current record
→ create event
→ commit in one transaction
```

### 6.3 User Job State

Saved/dismissed/viewed/applied are user-specific relationships.

```text
unseen
viewed
saved
dismissed
applied
```

Never place global flags such as `job.is_saved` on Canonical Job records.

### 6.4 Interviews

Interview records must:

```text
Belong to a user-owned Application.
Store scheduling times in UTC.
Store IANA timezone context.
Support multiple participants.
Store questions separately from the interview record.
Support preparation/outcome notes.
Support follow-up actions.
```

### 6.5 External Links

Meeting links, ATS apply links, portfolio links, and LeetCode links must:

```text
Be validated where applicable.
Open in a new tab only where appropriate.
Use target="_blank" and rel="noopener noreferrer".
Avoid exposing secrets in UI URLs/logs.
```

---

## 7. AI Conventions

### 7.1 AI Is Optional Assistance

AI enhances workflows but never blocks core manual workflows.

Manual fallback must exist for:

```text
Resume/profile creation
Interview creation
Interview invite capture
Job tracking
Notes
Questions
Follow-ups
Application status updates
```

### 7.2 Structured Outputs

All AI operations must define:

```text
Input contract
Output schema
Pydantic validation
Prompt version
Model/provider version
Failure fallback
Review requirement
Cost/rate-limit policy
```

Typical AI operations:

```text
Resume extraction
Skill extraction
Role normalization
Company/location normalization
Fast Capture extraction
Match explanation
Gap analysis
Interview preparation
Question classification
Outcome pattern analysis
```

### 7.3 Human-in-the-Loop

```text
AI suggestion
→ user review
→ accept / reject / edit
→ user-confirmed result becomes source of truth
```

AI must not silently overwrite:

```text
Candidate Profile
Career Direction
Resume Version
Application status
Interview notes
Contacts
Work authorization
User preferences
```

### 7.4 Data Minimization

Only send required context to an AI provider.

Examples:

```text
Skill extraction: relevant resume content
Fast Capture: user-pasted invite snippet
Interview prep: selected job snapshot + resume version + interview stage
Match explanation: structured factors + bounded evidence
```

Never send:

```text
Passwords
Password hashes
Session tokens
Password-reset tokens
Reset URLs
Database credentials
Provider API keys
Unrelated private user records
```

### 7.5 AI Output Language

AI-generated output must distinguish:

```text
Extracted fact
Inference
Recommendation
Unknown / insufficient evidence
```

Avoid definitive claims without evidence:

```text
Bad: You are not qualified.
Bad: The interviewer rejected you because of poor system design.

Preferred: Based on the available listing and saved profile, this requirement needs review.
Preferred: Your notes suggest system-design trade-offs may be a useful topic to revisit.
```

### 7.6 AI Cost and Reliability

AI workflows must use:

```text
Background tasks for non-trivial work
Idempotency keys
Input/output size limits
Per-user and per-feature budgets
Rate limits
Caching/deduplication
Retry limits
Provider fallback policy
Kill switches
Safe user-visible pending/failed/retry states
```

---

## 8. File Upload Conventions

### 8.1 Initial Format Policy

Initial production-supported format:

```text
PDF
```

Future formats require explicit validation/testing.

### 8.2 Upload Rules

```text
Authenticate user.
Enforce server-side size/type/rate/quota validation.
Generate storage keys.
Do not trust filenames or client Content-Type alone.
Store files privately outside web root.
Use authenticated download route or short-lived signed URLs.
Track scan/extraction status.
Queue extraction asynchronously.
Provide manual fallback if parsing fails.
```

### 8.3 Sensitive File Rules

Never log or broadly expose:

```text
Full resume contents
Signed download/upload URLs
Storage credentials
Extracted text
Private file metadata without access control
```

---

## 9. Background Job and Provider Conventions

### 9.1 Background Work

Use a durable background-task pattern for:

```text
Resume parsing
File scanning
AI extraction
Job source sync
Deduplication
Location normalization
Match generation
Email delivery
Notifications
Data exports
```

Every task type must define:

```text
Idempotency key
Timeout
Maximum retries
Retryable/non-retryable errors
Cost boundary
User-visible status
Operator-visible metrics
Cancellation behavior
```

### 9.2 Provider Controls

Every external provider integration needs:

```text
Timeout
Rate limit
Concurrency limit
Retry policy
Circuit breaker
Kill switch
Fallback behavior
Health metrics
Last-success timestamp
Reconciliation policy
```

### 9.3 Graceful Degradation

When a provider is unavailable:

```text
Do not delete existing user data.
Do not present a permanent spinner.
Use manual workflows where possible.
Show a safe retryable status.
Record operational error safely.
```

---

## 10. Security, Privacy, and Logging

### 10.1 Never Commit

```text
.env
.env.local
Database URLs
Provider API keys
Private keys
Tokens
Session cookies
Password-reset URLs
Passwords
Password hashes
Database dumps containing real data
Production exports
```

### 10.2 Logging

Structured logs may include:

```text
request_id
task_id
route
status code
duration
safe error code
provider
entity type/id
attempt count
release/environment
```

Never log:

```text
Passwords
Password hashes
Raw reset tokens
Full reset URLs
Session tokens
Authorization headers
Database credentials
Provider secrets
Full resume text
Full interview reflections
Private contact email addresses in broad telemetry
```

### 10.3 Data Retention

```text
Use archive/soft delete where history matters.
Do not hard-delete historical records through normal UI flows.
Define controlled purge/account-deletion workflow.
Preserve application snapshots according to retention policy.
```

### 10.4 Notifications

Notifications are distinct from follow-up actions.

```text
Follow-up = action record
Notification = reminder
Delivery = channel attempt/result
```

Notifications must support user control:

```text
Opt-in channels
Quiet hours
Timezone
Snooze/dismiss
Mute preferences
```

---

## 11. Testing Conventions

### 11.1 Backend Tests

All new backend behavior requires appropriate tests under:

```text
apps/api/tests/
```

Minimum protected-resource coverage:

```text
Authentication required
Owner can perform permitted action
Another user cannot read/update/archive/delete resource
Payload validation
Lifecycle/status transition validation
Expected database state
Safe error response
```

Additional coverage where relevant:

```text
Idempotency
Optimistic concurrency
Pagination
Filtering
Timezone handling
Background task retry/failure behavior
Provider fallback
Migration/data backfill
```

Run:

```bash
cd apps/api
python -m pytest -q
```

### 11.2 Frontend Validation

Frontend changes must be checked with project commands:

```bash
cd apps/web
npm run lint
npm run build
```

Use the project package manager consistently. Do not mix npm, pnpm, yarn, or bun lockfile ecosystems without an explicit migration.

### 11.3 UI Review Checklist

Check:

```text
Light theme
Dark theme
System theme
Desktop layout
Narrow/mobile layout
Keyboard navigation
Focus behavior
Loading state
Empty state
Error state
Long text
No-data behavior
Form validation
External-link safety
```

### 11.4 Migration Tests

Before applying a material migration:

```text
Review generated migration.
Check for destructive operations.
Test on representative data.
Verify no user/auth/application/interview data is lost.
Verify new indexes/constraints.
Confirm application can start and read/write expected data.
```

---

## 12. Documentation Conventions

### 12.1 Documentation Locations

```text
docs/
├── README.md
├── current-status.md
├── roadmap.md
├── product-requirements.md
├── architecture.md
├── engineering-conventions.md
└── spec/
```

### 12.2 Naming

```text
Format: Markdown (.md)
Filename style: lowercase kebab-case
Directory style: lowercase kebab-case
```

Correct:

```text
career-directions.md
jobs-workspace-v2.md
phase-2a-interviews-and-today.md
data-security-and-evolution.md
```

Avoid:

```text
CAREER_DIRECTIONS_SPEC.md
Jobs_V2_SPEC.md
Product Roadmap.md
careerDirections.spec
```

### 12.3 Documentation Update Rule

A material change is not complete until relevant documentation is updated.

Update:

```text
Module spec
API convention if shared contract changes
Architecture document if boundary changes
Roadmap/current-status after delivery
Migration notes for schema changes
Tests
```

Documentation must not contain secrets, real reset URLs, raw tokens, private user data, or provider credentials.

---

## 13. Definition of Done

A feature/change is complete only when all relevant items are true.

### Product and Documentation

- [ ] Requirements match `docs/product-requirements.md`.
- [ ] Domain model aligns with `docs/spec/01-domain-architecture.md`.
- [ ] Security/data constraints align with `docs/spec/02-data-security-and-evolution.md`.
- [ ] Relevant module spec is updated.
- [ ] `current-status.md` and `roadmap.md` are updated when a milestone is delivered.

### Backend and Database

- [ ] Pydantic request/response schemas are explicit.
- [ ] Protected endpoints derive identity from authenticated session.
- [ ] Object-level ownership checks exist for every private resource.
- [ ] Nested resources validate parent ownership.
- [ ] Status/lifecycle transitions are validated.
- [ ] Database changes use reviewed Alembic migration.
- [ ] Migration is additive or has explicit approved data-retention rationale.
- [ ] Sensitive fields are excluded from API responses/logs.
- [ ] Relevant backend tests pass.

### Frontend and Accessibility

- [ ] UI uses semantic Tailwind tokens.
- [ ] UI works in light, dark, and system themes.
- [ ] Responsive behavior is verified.
- [ ] Loading, empty, error, and success states exist.
- [ ] Keyboard/focus behavior is verified.
- [ ] Buttons/inputs use shared control standards.
- [ ] External links are safe.
- [ ] Frontend lint passes.
- [ ] Frontend production build passes.

### AI, Files, and Integrations

- [ ] AI work has structured schema, version metadata, fallback, and user review where required.
- [ ] AI/provider calls are bounded by timeout/rate/cost controls.
- [ ] File uploads are private, validated, and ownership-protected.
- [ ] Background tasks are idempotent, observable, and retry safely.
- [ ] Provider errors degrade gracefully.
- [ ] No secrets, tokens, passwords, or private content are committed or broadly logged.

### Final Review

- [ ] No temporary/debug artifacts are committed.
- [ ] No `.env` files or credentials are staged.
- [ ] No raw reset URL/token is included in code, documentation, or Git history.
- [ ] Change has a clear rollback/forward-fix plan if it affects persisted data.
- [ ] Relevant manual smoke test has been completed.
