# CareerNeed Product Roadmap

> **Version:** 2.0  
> **Status:** Active and Aligned  
> **Last Updated:** 2026-09-17  
> **Repository:** `careerneed`  
> **Source of Truth:** This roadmap sequences approved specifications. It does not override `01-domain-architecture.md` or `02-data-security-and-evolution.md`.

---

## Strategic Overview

CareerNeed transforms job search from a fragmented administrative chore into a deliberate career operating loop.

```text
Candidate Profile
  What I can do
        ↓
Career Direction
  What I want to pursue
        ↓
Resume Version
  How I present relevant evidence
        ↓
Canonical Job
  What opportunity exists
        ↓
Match Result
  How this opportunity fits my context
        ↓
Application
  What action I took
        ↓
Interview
  What happened and what I learned
        ↓
Follow-up / Career Intelligence
  What I should do next
```

The roadmap prioritizes reliable user-owned records and explainable context before automation and broad AI. AI should accelerate thoughtful workflows, not become a prerequisite for basic job tracking.

```text
Phase 1: Core Foundation                                 completed
   ↓
Phase 2A: Interview Workflow and Daily Execution         current
   ↓
Phase 2B: Candidate Context and Career Directions        next dependency
   ↓
Phase 2C: Job Catalog, Location, and Eligibility         catalog foundation
   ↓
Phase 2D: Contextual Matching Workspace                  decision support
   ↓
Phase 3: AI Interview Assistance and Fast Capture        optional intelligence
   ↓
Phase 4: Career Intelligence and Longitudinal Insights   learning loop
   ↓
Phase 5: Automation, Notifications, and Integrations     operational scale
```

---

## Phase 1: Core Foundation

> **Status:** Completed, with ongoing hardening  
> **Objective:** Establish authenticated, user-isolated, reliable job-search workflow records.

### Delivered

- Authentication:
  - Registration, login, logout, session-cookie authentication.
  - Current-user endpoint.
  - Password-reset token lifecycle.
  - Reset-password flow invalidating active sessions.
- User isolation:
  - Authenticated session-based ownership checks.
  - User-scoped application and related data access.
- Application tracking:
  - Core Application CRUD.
  - Application status workflow.
  - List/table and Pipeline Board views.
  - Status filters, search, follow-up dates, notes, and resume linking.
- Resume foundation:
  - Resume artifacts and basic upload/archive behavior.
- Jobs foundation:
  - Job listing/search UI.
  - Provider, workplace-type, date, and job-status filtering.
  - Matching-score threshold filter.
  - Result totals and pagination.
- Today foundation:
  - Due and overdue follow-up visibility.
- UI system:
  - Shared navigation.
  - Light/dark/system theme.
  - Shared semantic tokens.
  - Consistent content width and control patterns.

### Phase 1 Hardening Backlog

Before broad external release, verify:

```text
Password reset uses real delivery provider in production
No reset token/session/password data is logged
All private-resource APIs have ownership tests
Migrations are versioned and additive
Backup/restore process is tested
Local environment files are not tracked
```

---

## Phase 2A: Interview Workflow and Daily Execution

> **Status:** Current milestone  
> **Objective:** Turn active applications into structured interview journeys and reduce the friction of capturing interview information.

### 2A.1 Interview Data Foundation

Create the normalized interview workflow.

```text
Interview
├── Application relationship
├── Stage
├── Status
├── Scheduled UTC timestamp
├── IANA timezone
├── Duration
├── Format
├── Meeting location/link
├── Preparation notes
├── Outcome
└── Outcome notes
```

Supported interview statuses:

```text
scheduled
completed
cancelled
rescheduled
```

Suggested stages:

```text
recruiter_screen
hiring_manager
technical
behavioral
system_design
case_study
onsite
final
other
```

### 2A.2 Contacts and Interview Participants

Move beyond a single `interviewer_name` field.

```text
Contact
├── Recruiter
├── Interviewer
├── Hiring manager
├── Referral
└── Networking contact

Interview Participant
├── Interview
├── Contact
└── Participant role
```

This supports repeated interactions with the same recruiter or interviewer across multiple rounds.

### 2A.3 Interview Questions and Reflection

Create separately queryable question records.

```text
Interview Question
├── Question
├── Category
├── Difficulty
├── Answer notes
├── Reflection
├── Optional LeetCode URL
└── Asked timestamp
```

Support:

```text
behavioral
technical
coding
system_design
case
product
culture
other
```

### 2A.4 Application Detail Integration

In each Application detail workspace:

```text
Interviews
  Upcoming rounds
  Completed rounds
  Participants
  Preparation notes
  Questions
  Outcome
  Follow-up actions
```

### 2A.5 Follow-ups and Today

Add actionable follow-up records.

```text
Thank-you message reminder
Recruiter status check
Interview preparation task
Custom action
```

Today page priorities:

```text
Overdue follow-ups
Interviews today
Follow-ups due today
Upcoming interviews
Applications needing updates
```

### 2A.6 Fast Capture — Deferred Within Phase 2A

Fast Capture is valuable but must follow stable manual interview CRUD.

```text
Paste invite/email/message
→ parser suggests fields
→ user reviews and edits
→ user confirms save
```

Manual scheduling remains the complete fallback. Fast Capture must not block the Interview MVP.

### Phase 2A Exit Criteria

```text
Users can schedule, edit, reschedule, complete, and cancel interviews.
Interview times are stored in UTC with IANA timezone context.
One interview supports multiple participants.
Interview questions/reflections are separate records.
LeetCode links are validated and safely opened.
Follow-ups can be created and completed.
Today surfaces interview and follow-up actions correctly.
Every record is scoped to authenticated owner.
Manual workflows work when AI is unavailable.
```

---

## Phase 2B: Candidate Context and Career Directions

> **Status:** Next dependency after Interview foundation  
> **Objective:** Establish the user-side data model required for multi-track job search and meaningful matching.

### 2B.1 Candidate Profile

Build the durable candidate capability record.

```text
Candidate Profile
├── Summary/headline
├── Experience
├── Skills
├── Education
├── Projects
└── Work authorization
```

Candidate Profile represents what a user can do. It must remain distinct from resume versions and Career Directions.

### 2B.2 Career Directions

Implement persistent career goals.

```text
Career Direction
├── Name/category
├── Target roles
├── Seniority preferences
├── Location preferences
├── Work-arrangement preferences
├── Exclusions
├── Preferred resume
├── Active/paused/archived lifecycle
└── Default-direction behavior
```

Initial policy:

```text
Maximum active directions: configurable, default 5
One default active direction per user
```

### 2B.3 Resume Version Foundation

Strengthen resumes into immutable application/matching context.

```text
Resume
└── Resume Version
    ├── Version number
    ├── Immutable content/file snapshot
    ├── Current-version indicator
    └── Historical application references
```

### 2B.4 Work Authorization

Model work authorization independently from location preference.

```text
Country/jurisdiction
Authorization type
Sponsorship requirement
Expiration where relevant
```

### Phase 2B Exit Criteria

```text
Candidate capability and job-search intent are separate.
Users can create/manage multiple Career Directions.
Directions support active/paused/archived lifecycle.
User has at most one active default direction.
Resume Versions are immutable when historically referenced.
Work authorization is separate from location preference.
All private records enforce ownership.
```

---

## Phase 2C: Job Catalog, Location, and Eligibility

> **Status:** Depends on Phase 2B  
> **Objective:** Build a trustworthy job catalog with source provenance, lifecycle, location normalization, and eligibility inputs.

### 2C.1 Company and Canonical Job Model

Create reusable company and canonical job records.

```text
Company
├── Normalized identity
├── Website
├── Industry
├── Size/stage
└── Location metadata

Canonical Job
├── Company relationship
├── Title
├── Description
├── Normalized role
├── Lifecycle
├── Locations
├── Work arrangement
├── Sponsorship policy
└── Source listings
```

### 2C.2 Job Source Ingestion

Support staged integrations:

```text
Manual entry
Ashby
Greenhouse
Lever
Company career sites
Future browser extension/import
```

Requirements:

```text
Provider/external-ID idempotency
Source URL preservation
Raw source provenance
Source last-seen timestamps
Rate-limit controls
Source failure monitoring
Terms/access review before scale
```

### 2C.3 Deduplication and Lifecycle

```text
Source listing
→ normalization
→ duplicate detection
→ canonical job
→ lifecycle updates
```

Canonical lifecycle:

```text
discovered
active
expired
closed
removed
```

Applications must remain valid and historically accessible after a job closes or disappears.

### 2C.4 Location, Arrangement, and Eligibility Inputs

Model separately:

```text
Career Direction location preference
Work authorization
Job physical location(s)
Job remote scope(s)
Job work arrangement
Job sponsorship policy
```

Location eligibility results:

```text
eligible
not_eligible
needs_review
insufficient_data
```

Do not make hard legal/location decisions from low-confidence inference.

### Phase 2C Exit Criteria

```text
Jobs have canonical/source separation.
Multiple sources can map to one canonical job.
Job lifecycle does not delete application history.
Locations support multiple physical sites and remote scope.
Location preference is separate from work authorization.
Normalization records confidence/source/version.
Ingestion and normalization are idempotent and observable.
```

---

## Phase 2D: Contextual Matching and Jobs Workspace

> **Status:** Depends on Phase 2B and 2C  
> **Objective:** Transform Jobs from generic listing search into direction-aware decision support.

### 2D.1 Match Result

Implement contextual matching.

```text
Job
+ Candidate Profile
+ Career Direction
+ Resume Version
+ Work Authorization
+ Matching Configuration
+ Algorithm version
+ Taxonomy version
= Match Result
```

Required outputs:

```text
Eligibility
Eligibility reasons
Match score when appropriate
Score breakdown
Matched skills
Missing skills
Strengths
Risks
Explanation
Version metadata
```

### 2D.2 Jobs Workspace V2

Implement direction-aware Jobs behavior:

```text
Selected active Career Direction
Direction defaults
Temporary filter overrides
Canonical job list
User-specific saved/dismissed/applied state
Contextual Match Results
Source provenance
Eligibility explanations
Total result count
Pagination
```

Retain existing UX requirements:

```text
Provider: multi-select
Workplace type: multi-select
Date: multi-select/presets
Job state: multi-select
Match score: single-select threshold
Total count and pagination: required
```

### 2D.3 Application Context Snapshots

When creating an Application from Jobs, preserve:

```text
Career Direction snapshot
Resume Version snapshot/reference
Job snapshot
Match Result snapshot/reference
```

### Phase 2D Exit Criteria

```text
Match score is not stored as a global job property.
Jobs are evaluated per active direction/resume context.
Eligibility is distinct from score.
Users understand why a job fits, does not fit, or needs review.
Saved/dismissed/applied state is user-specific.
Applications preserve matching context historically.
```

---

## Phase 3: AI Interview Assistance and Fast Capture

> **Status:** Depends on reliable Phase 2A data and AI governance controls  
> **Objective:** Reduce preparation friction while retaining user review and manual fallback.

### 3.1 Fast Capture

```text
Paste recruiter email/calendar invite/message
→ extract proposed company/application
→ extract interviewer, stage, date/time, duration, meeting URL
→ preview
→ user confirms/edits
→ create Interview
```

Requirements:

```text
Manual fallback always available
Extraction confidence available internally
No silent write without user confirmation
No credentials/tokens sent to provider
Task is idempotent
Failures/retries are visible
```

### 3.2 Interview Preparation

Inputs:

```text
Job snapshot
Submitted Resume Version
Career Direction
Interview stage
Interview participants when available
Prior questions/reflections where user permits
```

Outputs:

```text
Potential technical questions
Relevant behavioral stories
Preparation checklist
Gap warnings
Questions to ask interviewer
```

### 3.3 Post-Interview Debrief

```text
Questions asked
Strong answers
Uncertain/stuck areas
Interviewer feedback
Outcome
Next follow-up
```

### 3.4 Readiness Assessment

Readiness differs from Match.

```text
Match:
Historical alignment with job requirements

Readiness:
Preparation level for a specific interview/application/time
```

### Phase 3 Exit Criteria

```text
AI output is versioned and reviewable.
Users can accept, reject, or edit meaningful AI suggestions.
Manual workflow remains fully functional during AI failure.
Preparation/debrief data is linked to correct application/interview context.
No AI operation silently overwrites user-confirmed data.
```

---

## Phase 4: Career Intelligence and Longitudinal Insights

> **Status:** Depends on sufficient reliable historical data  
> **Objective:** Turn user-owned history into clear learning and decision support.

### 4.1 Event Timeline and Snapshots

Maintain:

```text
Application status events
Interview events
Follow-up events
Resume/application snapshots
Match-result versions
AI suggestion outcomes
```

### 4.2 Career Analytics

Potential user-facing insights:

```text
Application → screening → interview → offer conversion
Interview outcome by stage
Question category patterns
Follow-up completion behavior
Resume Version usage/outcome patterns
Direction-level application activity
Time spent in each application stage
```

Avoid claiming causality from sparse personal data.

### 4.3 Pattern Recognition

Examples:

```text
Repeated system-design weakness themes
Recurring behavioral story gaps
High success rate in recruiter screens but low coding-screen conversion
Jobs repeatedly dismissed due to location or sponsorship constraints
```

AI-generated patterns remain recommendations, not definitive explanations of employer decisions.

### 4.4 Export and History

Provide portable export capabilities:

```text
JSON
CSV
Resume/application metadata
Interview and follow-up history
```

Exclude secrets and security-sensitive values.

### Phase 4 Exit Criteria

```text
Historical records are trustworthy and versioned.
Analytics uses user-owned data safely.
Insights distinguish observed patterns from inference.
Users can export appropriate career data.
```

---

## Phase 5: Automation, Notifications, and Integrations

> **Status:** Depends on stable workflows, reliable background jobs, and notification preferences  
> **Objective:** Provide background support without taking away user control.

### 5.1 Notifications

```text
In-app reminders
Optional email reminders
Future push notifications
Quiet hours
Timezone-aware scheduling
Snooze/mute controls
Delivery logs
```

Notifications are separate from Follow-ups:

```text
Follow-up = work the user should do
Notification = reminder to do it
Delivery = actual channel attempt/result
```

### 5.2 Calendar Integrations

Potential later integrations:

```text
Google Calendar
Outlook Calendar
ICS export/import
```

Requirements:

```text
Clear sync direction
Conflict strategy
User consent
Safe event updates/deletes
Timezone correctness
Provider failure/reconciliation handling
```

### 5.3 Browser Extension

Potential future workflow:

```text
Save job from LinkedIn/Indeed/company site
→ extract minimal source/job context
→ user confirms
→ create UserJobState or manual Job/Application
```

Do not assume scraping access is permitted; source terms, APIs, and legal constraints must be reviewed.

### 5.4 Automated Job Source Health

```text
Source sync health
Rate-limit visibility
Failure alerts
Stale source detection
Reconciliation tasks
Provider disable/kill switch
```

### Phase 5 Exit Criteria

```text
Users control reminder channels and frequency.
External integrations are opt-in and reversible.
Delivery/sync failures are observable.
Automation is idempotent and does not create duplicate records.
Manual workflows remain available.
```

---

## Cross-Phase Engineering Standards

Every phase must comply with:

```text
Authenticated object-level authorization
Timezone-aware timestamps
Additive Alembic migrations
Backup and restore validation
Soft delete/archive behavior where history matters
Idempotency for retry-sensitive actions
Optimistic concurrency for critical updates
Structured error handling
No secret/token/password logging
Accessible light/dark responsive UI
Clear user-visible loading/error/empty states
```

AI-related phases additionally require:

```text
Provider/model/prompt version metadata
Cost monitoring and budgets
Rate limits
Fallbacks
Evaluation datasets
User review/correction
Kill switch
```

---

## Recommended Current Execution Order

```text
1. Finish Phase 2A Interview manual CRUD and Today integration.
2. Commit/test Interview work separately.
3. Implement Candidate Profile and Career Directions in Phase 2B.
4. Add Resume Version and Work Authorization foundations.
5. Build canonical job/company/source/lifecycle model in Phase 2C.
6. Add location/remote scope normalization and eligibility.
7. Implement Match Result and Jobs V2 in Phase 2D.
8. Add Fast Capture and AI interview preparation in Phase 3.
9. Add longitudinal intelligence after enough trustworthy data exists.
10. Add notifications/calendar/browser integrations last.
```

---

## Roadmap Governance

- This file sequences work; it does not replace module specs.
- Do not move AI/automation earlier merely because an interface can be mocked.
- Do not add destructive database changes without an approved migration, backup, and validation plan.
- Do not broaden integrations before confirming core manual workflows have reliable adoption and data quality.
- Each phase exits only when its Definition of Done and cross-phase standards are met.
