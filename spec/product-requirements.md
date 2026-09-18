# CareerNeed Product Requirements

> **Version:** 1.0  
> **Status:** Active and Aligned  
> **Last Updated:** 2026-09-17  
> **Product Name:** CareerNeed  
> **Repository:** `careerneed`  
> **Source of Truth:** This PRD defines user problems, outcomes, requirements, and acceptance criteria. It does not override `spec/01-domain-architecture.md` or `spec/02-data-security-and-evolution.md`.

---

## 1. Product Summary

CareerNeed is a privacy-first, AI-assisted career operating system for people managing an active job search.

The product helps users organize opportunities, applications, interview preparation, contacts, follow-ups, career evidence, and learning history without requiring spreadsheets, scattered notes, or repeated manual entry.

> **North Star Mission**  
> **Help users spend less time recording, focus more on deliberate self-improvement, and receive actionable help throughout their career journey.**

CareerNeed is not merely:

```text
A generic job board
A resume parser
A spreadsheet replacement
A Kanban board
A generic AI chatbot
```

It is a connected career workspace.

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
  How the opportunity fits my current context
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

---

## 2. Problem Statement

Job seekers face three connected problems.

### 2.1 Fragmented opportunity discovery

Opportunities appear across:

```text
Company career sites
Public ATS boards
LinkedIn
Referrals
Recruiter messages
Email
Community/shared links
Personal networks
```

Users repeatedly inspect duplicate listings, lose opportunities, and cannot reliably connect a job to their current target role, resume, or constraints.

### 2.2 Administrative overhead

Users manually maintain:

```text
Application status
Job URLs
Resume versions
Recruiter contacts
Interview schedules
Meeting links
Interview questions
Personal notes
Follow-up dates
Outcomes
```

This causes missed follow-ups, forgotten interview details, inconsistent records, and unnecessary cognitive load.

### 2.3 The black-box improvement loop

Users often cannot answer:

```text
Why does this job fit or not fit me?
Which missing skills are truly important?
What resume did I use for this application?
What pattern exists across failed interviews?
Which interview topics should I prioritize next?
What action should I take today?
```

Generic advice such as “do more LeetCode” or “improve your resume” does not connect a candidate’s evidence, current target, specific job requirements, and interview history.

---

## 3. Product Principles

### 3.1 Separate capability from intent

```text
Candidate Profile
= Skills, experience, education, projects, evidence

Career Direction
= Target roles, seniority, locations, work arrangements, exclusions
```

A user may have one complete profile and multiple career directions.

### 3.2 Separate profile from resume

```text
Candidate Profile
= Complete professional record

Resume
= Named presentation artifact

Resume Version
= Immutable version selected for a job/application
```

### 3.3 Make matching contextual and explainable

```text
Match Score ≠ Job property

Match Result
= Job
+ Candidate Profile
+ Career Direction
+ Resume Version
+ Work Authorization
+ Matching Configuration
+ Algorithm Version
+ Taxonomy Version
```

### 3.4 Preserve historical truth

Later changes to a resume, direction, job listing, company record, taxonomy, or AI algorithm must not rewrite the user’s historical application context.

### 3.5 Keep users in control

```text
AI can suggest.
AI cannot silently decide.
Users review, accept, reject, or edit meaningful AI output.
```

### 3.6 Keep daily interaction simple

Users should understand the primary action on each page at a glance. Complex data models must reduce cognitive load rather than produce more forms, cards, or competing calls to action.

### 3.7 Respect privacy by default

Resumes, applications, work authorization, interview notes, recruiter contacts, and AI-generated career analysis are sensitive personal data.

---

## 4. User Personas

### 4.1 Primary Persona: Active Technical Job Seeker

Typical roles:

```text
Software Engineer
Full Stack Engineer
Frontend Engineer
Backend Engineer
Platform Engineer
SRE
DevOps Engineer
AI/ML Infrastructure Engineer
Data Analyst
Data Engineer
Product Analyst
Engineering Manager
```

Goals:

```text
Find relevant opportunities
Track applications and interviews
Avoid missing follow-ups
Tailor resume strategy
Improve interview performance
Understand recurring skill gaps
Preserve career history
```

Pain points:

```text
Many sources, duplicate jobs, scattered information
Time-consuming application management
No trustworthy record of what was submitted
Unclear job fit
No systematic interview learning loop
```

### 4.2 Secondary Persona: Multi-Track Career Seeker

A user may simultaneously pursue several related targets:

```text
Full Stack Engineering
Frontend Engineering
Data Analytics
Product Analytics
Engineering Management
```

They need separate preferences/resumes/matching contexts without duplicating their full career history.

### 4.3 Future Persona: Career Coach or Advisor

Not part of the initial consumer release.

Future coaches may need controlled delegated access to selected user data. This requires explicit organization/membership/permission design and must not weaken current user ownership/privacy guarantees.

---

## 5. Core User Stories

### 5.1 Candidate Profile

> As a job seeker, I want to record or import my skills, experience, education, and projects so CareerNeed can understand my complete professional background.

> As a user, I want to review and correct imported resume data before it becomes part of my profile.

### 5.2 Career Directions

> As a multi-track candidate, I want to create several Career Directions so I can search for Full Stack Engineering and Data Analytics roles without constantly replacing one global preference set.

> As a user, I want to pause or archive a direction without losing the applications, resumes, matches, and history associated with it.

### 5.3 Resume Versions

> As a candidate, I want to maintain several resume versions and know exactly which version I used for every application.

> As a user, I want later resume edits to create a new version rather than changing historical applications.

### 5.4 Jobs Discovery

> As a job seeker, I want jobs organized around my selected active Career Direction so the default roles, seniority, locations, work arrangement, and preferred resume are relevant.

> As a user, I want to search, filter, save, dismiss, and review jobs without changing my saved Career Direction preferences accidentally.

> As a user, I want to know whether a job is active, expired, closed, or removed, while still being able to view jobs associated with my past applications.

### 5.5 Match and Eligibility

> As a candidate, I want an explainable evaluation of how a job fits my selected direction and resume so I can prioritize my effort.

> As a user, I want CareerNeed to distinguish between a lower-fit job and a job that conflicts with a hard constraint such as remote scope, work arrangement, sponsorship policy, or work authorization.

### 5.6 Applications

> As an applicant, I want to create and update applications from jobs or manual entries so I can track my real decisions.

> As a user, I want an Application List and Pipeline Board so I can review details and understand my overall process quickly.

> As a user, I want to retain the job, direction, resume, and match context that existed when I applied.

### 5.7 Interviews

> As an active candidate, I want to schedule multiple interview rounds under an application so I can track each stage, meeting link, participants, questions, preparation, and outcome.

> As a user, I want to record interview questions and reflections while they are fresh so I can improve future interviews.

> As a technical candidate, I want to save optional LeetCode links for coding questions.

### 5.8 Follow-ups and Today

> As a user, I want a focused Today page showing overdue follow-ups, interviews today, upcoming interviews, and actions due today.

> As a user, I want reminders to be helpful and controllable, not noisy.

### 5.9 AI Assistance

> As a user, I want AI to help extract profile information, parse interview invites, explain job matches, recommend preparation, and identify learning patterns, while allowing me to review or correct significant suggestions.

### 5.10 Career History

> As a long-term user, I want my resume versions, applications, interview notes, outcomes, and relevant snapshots preserved so I can learn from previous job searches and reapply effectively.

---

## 6. Functional Requirements

## 6.1 Authentication and Account Security

The platform must provide:

```text
Registration
Login
Logout
Session-based authentication
Current-user endpoint
Password reset request
Password reset completion
Session invalidation after password reset
```

Requirements:

```text
Passwords are stored only as secure non-reversible hashes.
Password-reset tokens are stored hashed and are short-lived/single-use.
Password reset invalidates active sessions.
Authentication responses avoid revealing whether an account exists where appropriate.
```

## 6.2 Candidate Profile

The platform must allow a user to maintain:

```text
Headline/summary
Experience
Skills
Education
Projects
Supporting evidence
Work authorization
Timezone
```

Requirements:

```text
Profile data is user-owned.
Resume imports create reviewable extracted suggestions.
User-confirmed data is not silently overwritten by new parser/AI runs.
Source and confidence metadata may be retained for extracted information.
```

## 6.3 Career Directions

Each Career Direction must support:

```text
Name
Category
Target roles
Seniority preferences
Location preferences
Work arrangement preferences
Exclusions
Preferred resume
Status: active / paused / archived
Default-direction indicator
```

Requirements:

```text
A user may have multiple directions.
Only active directions drive default Jobs discovery.
A user has at most one active default direction.
The number of active directions is configurable by product entitlement/policy.
Career Direction location preference is distinct from Work Authorization.
Archiving a direction does not delete historical applications/interviews/matches.
```

## 6.4 Resume and Resume Versions

The platform must support:

```text
Multiple named resumes
Multiple ordered versions per resume
Current-version selection
Preferred resume per Career Direction
Reference to source file/content
Historical application snapshot/reference
Archive/soft delete behavior
```

Requirements:

```text
A Resume Version referenced by an Application or Match Result is immutable.
Editing creates a new version.
A user may select a non-default resume for a specific Application.
Deleting/archiving a resume must not silently erase historical application evidence.
```

## 6.5 Jobs Discovery

Jobs must support:

```text
Canonical Job
Company relationship
Job Source provenance
Lifecycle
Location(s)
Remote scope(s)
Work arrangement
Sponsorship policy where available
Normalized role confidence/review state
```

Jobs workspace requirements:

```text
Selected active Career Direction context
Search
Provider multi-select
Workplace-type multi-select
Posted-date multi-select/presets
Job-state multi-select
Match-score single-select threshold
Total matching result count
Pagination
Direction-default filters
Temporary user overrides
Reset to direction defaults
```

User-specific job states:

```text
unseen
viewed
saved
dismissed
applied
```

Saved/dismissed/applied state must not be stored as a global Job property.

## 6.6 Location and Eligibility

The platform must distinguish:

```text
Career Direction location preference
Work authorization
Job physical location
Job remote scope
Job work arrangement
Job sponsorship policy
Eligibility decision
Location-fit score
```

Eligibility states:

```text
eligible
not_eligible
needs_review
insufficient_data
```

Requirements:

```text
Hard constraints are evaluated separately from soft scoring.
Unknown/low-confidence data does not create misleading hard rejection.
The product explains eligibility using listing information and user preferences.
The product does not present legal advice.
```

## 6.7 Match Results

A Match Result must be contextual:

```text
Job
+ Candidate Profile
+ Career Direction
+ Resume Version
+ Work Authorization
+ Matching Configuration
+ Algorithm Version
+ Taxonomy Version
```

Required output:

```text
Eligibility
Eligibility reasons
Score when appropriate
Score breakdown
Matched skills
Missing skills
Strengths
Risks
Explanation
Generation timestamp
Algorithm/taxonomy version
```

Requirements:

```text
Match score is not a global Job attribute.
Historical Application pages use snapshots/current-at-application match context.
A new match may be generated when material inputs change.
Users can understand why a score or eligibility state exists.
```

## 6.8 Applications

Application states:

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

The platform must support:

```text
Application List
Pipeline Board
Status updates
Company/job/title/URL snapshots
Career Direction snapshot
Resume Version snapshot/reference
Match Result snapshot/reference
Notes
Follow-up scheduling
Contacts
Events/timeline
Soft delete/restore
```

Requirements:

```text
Offer is not terminal; user can accept, decline, or withdraw.
State transitions are explicit.
Significant application changes create immutable timeline events.
Application creation is idempotent.
Critical updates support concurrency protection.
```

## 6.9 Interviews

The platform must support multiple interviews per application.

Interview fields:

```text
Stage
Status
Scheduled UTC time
IANA timezone
Duration
Format
Meeting link/location
Preparation notes
Outcome
Outcome notes
```

Interview stages:

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

Interview statuses:

```text
scheduled
completed
cancelled
rescheduled
```

Interview outcomes:

```text
pending
advance
rejected
offer
withdrawn
unknown
```

Each interview must support:

```text
Multiple participants
Interview questions
Answer notes
Reflections
Optional LeetCode link
Follow-up actions
```

## 6.10 Today and Follow-ups

Today must prioritize:

```text
Overdue follow-ups
Interviews today
Follow-ups due today
Upcoming interviews
Applications needing updates
```

Follow-up types:

```text
thank_you
status_check
recruiter_reply
preparation
custom
```

Requirements:

```text
Follow-up is an action record.
Notification delivery is separate from Follow-up.
Today remains useful even if email/push notifications are unavailable.
```

## 6.11 AI Assistance

AI features may support:

```text
Resume/profile extraction
Role/company/location normalization
Job matching explanation
Gap analysis
Fast Capture interview invite parsing
Interview preparation
Question classification
Outcome/pattern analysis
Follow-up recommendation
```

Requirements:

```text
AI outputs are versioned.
Meaningful AI suggestions support accept/reject/edit.
AI never silently overwrites confirmed user data.
Manual workflow remains available.
AI input is minimized.
AI output distinguishes facts, inference, recommendation, and uncertainty.
```

## 6.12 File Upload and Resume Ingestion

Initial upload support:

```text
PDF
```

Requirements:

```text
Private storage
Authenticated file access
File type/size/quota validation
Generated storage keys
Content validation where feasible
Asynchronous extraction
Safe parse failure handling
Manual text/profile fallback
Soft delete/retention policy
```

## 6.13 Notifications and Integrations

Later requirements include:

```text
In-app notifications
Optional email reminders
Quiet hours
Timezone-aware reminder scheduling
Calendar integrations
Browser extension job saving
Job-source health checks
```

All integrations must be:

```text
Opt-in
Idempotent
Observable
Reversible where possible
Non-blocking for manual workflows
```

---

## 7. Non-Functional Requirements

## 7.1 Privacy and Security

```text
All private resources use authenticated object-level authorization.
Client-supplied user_id is never trusted.
Passwords use secure one-way hashes.
Reset tokens are hashed and are not logged in raw form.
Resumes, interview notes, work authorization, contacts, and AI data are treated as sensitive.
Secrets, passwords, tokens, cookies, reset URLs, database URLs, and provider credentials are never committed or broadly logged.
```

## 7.2 Reliability

```text
Core tracking works when AI providers are unavailable.
Manual interview creation works when Fast Capture fails.
Jobs/application/interview CRUD does not depend on external providers.
Background tasks are idempotent and retry safely.
Provider outages do not delete historical data.
```

## 7.3 Data Durability

```text
Schema evolution uses reviewed Alembic migrations.
Migrations are additive by default.
Backups are created and restore-tested.
No normal startup/deployment flow uses drop_all().
Historical snapshots/events preserve application context.
User-facing deletion uses archive/soft delete first where appropriate.
```

## 7.4 Performance

Initial performance goals must be measurable at representative load.

```text
Direction selector: immediate visual feedback
Typical Jobs list API: target p95 under 500ms at expected early load
Upcoming interview/Today queries: indexed and target p95 under 300ms at expected early load
Fast Capture/AI extraction: asynchronous with visible pending state; do not require blocking request completion
```

The product must not promise an unconditional latency target where external AI/provider response time is variable.

## 7.5 Accessibility and Design Consistency

```text
Light, dark, and system theme support
Responsive desktop/mobile layouts
Keyboard-accessible controls
Correct focus management for drawers/dialogs
Semantic Tailwind tokens
Consistent global content widths/margins
Default controls use 40px medium height unless documented otherwise
Color is not the only indicator of status
```

## 7.6 Observability

The platform must collect safe metrics/logs for:

```text
API error/latency
Database performance
Queue/task health
Job source sync
File upload/parsing
AI cost/failure/quality
Notification delivery
Backup/restore
```

Logs must never contain sensitive secrets or full private content.

---

## 8. Delivery Phases

### Phase 1 — Core Foundation

```text
Authentication
Sessions
Applications foundation
Jobs filters/search foundation
Resume foundation
Pipeline/List UI
Today follow-up foundation
Theme/design system
```

### Phase 2A — Interviews and Today

```text
Interview CRUD
Interview participants
Interview questions/reflections
LeetCode links
Follow-ups
Today interview/follow-up actions
Manual workflows first
```

### Phase 2B — Candidate Context

```text
Candidate Profile
Career Directions
Resume Versions
Work Authorization
Location preference foundations
```

### Phase 2C — Job Catalog

```text
Company
Canonical Job
Job Source
Job lifecycle
Location/remote scope normalization
Deduplication
```

### Phase 2D — Contextual Matching

```text
Matching configuration
Eligibility
Match Result
Score breakdown
Versioning
Jobs Workspace V2
Application context snapshots
```

### Phase 3 — AI Interview Assistance

```text
Fast Capture
Interview preparation
Post-interview debrief assistance
Readiness assessments
AI review/correction workflow
```

### Phase 4 — Career Intelligence

```text
Timeline and historical analytics
Conversion analysis
Question/interview pattern analysis
Career-gap recommendations
Data export
```

### Phase 5 — Automation and Integrations

```text
Notifications
Calendar integrations
Browser extension
Provider health monitoring
Automated reconciliation
```

---

## 9. Product Acceptance Criteria

CareerNeed is ready to advance through its early phases when:

```text
A user can safely create an account and retain private career data.
A user can track an application from saved through final outcome.
A user can record several interviews, participants, questions, reflections, and follow-ups.
A user can see urgent next actions in Today.
A user can maintain separate career directions without duplicating full profile data.
A user can maintain immutable resume versions.
A user can understand job fit in a selected direction/resume context.
A user can distinguish eligible, ineligible, uncertain, and low-fit jobs.
A user does not lose prior application/resume/interview history when data changes.
AI features remain optional, reviewable, explainable, and non-blocking.
The product protects private data and can evolve schema safely.
```

---

## 10. Out of Scope

The following are intentionally not required for the initial CareerNeed product:

```text
Employer recruiting workflow
Automated ATS application submission
Guaranteed job/interview outcome prediction
Legal immigration/work-authorization advice
Public social network or job-seeker marketplace
Unrestricted general-purpose file storage
Fully autonomous AI profile/job/application editing
Enterprise permissions before a validated collaboration use case
```

---

## 11. Final Product Requirement

CareerNeed succeeds when it makes a job search feel less like fragmented administration and more like an understandable operating system:

```text
Know what I can do.
Know what I want.
See relevant opportunities.
Understand fit and constraints.
Track real decisions.
Prepare deliberately.
Learn from outcomes.
Take the next best action.
Keep control of my private career history.
```
