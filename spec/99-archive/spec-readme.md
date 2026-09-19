---
status: archived
superseded_by: ../README.md
reason: Replaced by consolidated spec/README.md documentation center.
archived_date: 2026-09-19
---

> **ARCHIVED DOCUMENTATION**  
> This specification has been archived and superseded as part of the 2026-09-19 documentation consolidation.  
> It is preserved for historical decision context and provenance only. For current authoritative architecture, see [../README.md](../README.md).

# CareerNeed Documentation Center

> This directory is the official technical, product, architecture, and engineering documentation center for **CareerNeed**.  
> It contains product vision, domain specifications, implementation contracts, architecture decisions, engineering standards, and delivery roadmaps.

---

## 1. Product Vision

CareerNeed is an **AI-assisted, privacy-first career operating system** for people managing an active job search.

> **North Star Mission**  
> **Help users spend less time recording, focus more on deliberate self-improvement, and receive actionable help throughout their career journey.**

CareerNeed is not only a job board, resume parser, or application tracker. It connects a user’s capabilities, career goals, resumes, job opportunities, applications, interviews, follow-ups, and learning history into one coherent system.

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
  How that opportunity fits my current context
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

## 2. Architecture Principles

All product and engineering work must follow these principles.

### Candidate capability is not career intent

```text
Candidate Profile
= Experience, skills, education, projects, evidence

Career Direction
= Target roles, seniority, locations, work arrangements, exclusions
```

A user can have one broad professional profile and several Career Directions.

### Resume is not Candidate Profile

```text
Candidate Profile
= Complete professional identity

Resume
= Targeted presentation artifact

Resume Version
= Immutable version used for a job, match, or application
```

### Match Score is contextual

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

### Historical data must remain valid

Applications, interviews, selected resumes, jobs, match results, and status changes must retain snapshots/events so later profile, resume, job, taxonomy, or AI updates do not rewrite historical truth.

### AI assists; users decide

```text
AI suggestion
→ user review
→ accept / reject / edit
→ user-confirmed data becomes source of truth
```

AI must never silently overwrite user-confirmed data.

### Private data is owner-scoped

All user-owned records are accessed through authenticated ownership checks. Client-provided `user_id` is never trusted.

---

## 3. Documentation Structure

```text
docs/
├── README.md
├── current-status.md
├── portfolio-demo-guide.md
├── product-requirements.md
├── architecture.md
├── engineering-conventions.md
├── roadmap.md
│
├── spec/
│   ├── README.md
│   ├── 00-global-product.md
│   ├── 01-domain-architecture.md
│   ├── 02-data-security-and-evolution.md
│   ├── 03-candidate-profile.md
│   ├── 04-career-directions.md
│   ├── 05-resume-versioning.md
│   ├── 06-location-eligibility.md
│   ├── 07-job-catalog-ingestion.md
│   ├── 08-jobs-workspace-v2.md
│   ├── 09-matching-ai-governance.md
│   ├── 10-applications-workflow.md
│   ├── 11-interviews-followups-today.md
│   ├── 12-api-conventions.md
│   ├── 13-file-storage-and-resume-ingestion.md
│   ├── 14-background-jobs-and-integration-reliability.md
│   ├── 15-observability-and-operations.md
│   ├── 16-notifications-and-delivery.md
│   └── 17-ai-cost-quality-and-evaluation.md
│
└── phases/
    ├── phase-1-core-foundation.md
    ├── phase-2a-interviews-and-today.md
    ├── phase-2b-candidate-context-and-directions.md
    ├── phase-2c-job-catalog-and-location.md
    ├── phase-2d-contextual-matching.md
    ├── phase-3-ai-interview-assistance.md
    ├── phase-4-career-intelligence.md
    └── phase-5-automation-and-integrations.md
```

## 4. Core Documents

| Document                                                   | Nature               | Purpose                                                                                   | Primary audience                         |
| ---------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`current-status.md`](current-status.md)                   | Baseline             | Verified implementation inventory, known gaps, environment assumptions, and active risks  | All contributors                         |
| [`roadmap.md`](roadmap.md)                                 | Delivery plan        | Sequenced implementation phases and exit criteria                                         | Product, engineering, project management |
| [`product-requirements.md`](product-requirements.md)       | PRD                  | User problems, personas, stories, outcomes, and feature requirements                      | Product, QA, design, engineering         |
| [`architecture.md`](architecture.md)                       | Technical design     | Web/API/database/worker boundaries, deployment, integrations, and architecture decisions  | Backend, platform, architecture          |
| [`engineering-conventions.md`](engineering-conventions.md) | Engineering standard | Coding, API, UI, testing, accessibility, migration, and review conventions                | All engineers                            |
| [`portfolio-demo-guide.md`](portfolio-demo-guide.md)       | Demo/interview guide | Product narrative, demo scripts, architecture story, and role-tailored portfolio material | Candidate/interview preparation          |
| [`spec/README.md`](spec/README.md)                         | Spec index           | Naming rules, authority order, dependency order, and change process                       | All contributors                         |

## 5. Domain Specifications

| File                                                                                                               | Scope                                                                            | Dependency / authority                        |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------- |
| [`spec/00-global-product.md`](spec/00-global-product.md)                                                           | Product mission, modules, user journey, phases                                   | Product-wide overview                         |
| [`spec/01-domain-architecture.md`](spec/01-domain-architecture.md)                                                 | Canonical objects, boundaries, relationships, historical truth                   | Primary domain authority                      |
| [`spec/02-data-security-and-evolution.md`](spec/02-data-security-and-evolution.md)                                 | Authentication, authorization, privacy, migrations, backups, retention           | Primary security/operations authority         |
| [`spec/03-candidate-profile.md`](spec/03-candidate-profile.md)                                                     | Candidate identity, skills, experience, education, projects, work authorization  | Candidate foundation                          |
| [`spec/04-career-directions.md`](spec/04-career-directions.md)                                                     | Career goals, lifecycle, default direction, preferences, active-direction limits | Depends on Candidate Profile boundary         |
| [`spec/05-resume-versioning.md`](spec/05-resume-versioning.md)                                                     | Resume artifacts, immutable versions, application snapshots                      | Depends on Candidate Profile and Applications |
| [`spec/06-location-eligibility.md`](spec/06-location-eligibility.md)                                               | Geography, remote scope, work arrangement, sponsorship, eligibility              | Depends on Career Directions and Job Catalog  |
| [`spec/07-job-catalog-ingestion.md`](spec/07-job-catalog-ingestion.md)                                             | Companies, canonical jobs, sources, ingestion, deduplication, lifecycle          | Catalog foundation                            |
| [`spec/08-jobs-workspace-v2.md`](spec/08-jobs-workspace-v2.md)                                                     | Direction-aware Jobs UX, filters, paging, job cards, user states                 | Depends on Directions, Jobs, Matching         |
| [`spec/09-matching-ai-governance.md`](spec/09-matching-ai-governance.md)                                           | Match Result, eligibility, explanations, versions, AI review                     | Depends on Profile, Directions, Resume, Jobs  |
| [`spec/10-applications-workflow.md`](spec/10-applications-workflow.md)                                             | Application state machine, events, snapshots, idempotency, concurrency           | Historical workflow authority                 |
| [`spec/11-interviews-followups-today.md`](spec/11-interviews-followups-today.md)                                   | Interviews, contacts, questions, LeetCode links, follow-ups, Today               | Depends on Applications                       |
| [`spec/12-api-conventions.md`](spec/12-api-conventions.md)                                                         | REST conventions, validation, errors, pagination, timestamps                     | Shared implementation standard                |
| [`spec/13-file-storage-and-resume-ingestion.md`](spec/13-file-storage-and-resume-ingestion.md)                     | Private uploads, validation, parsing, storage, retention                         | Required before production uploads            |
| [`spec/14-background-jobs-and-integration-reliability.md`](spec/14-background-jobs-and-integration-reliability.md) | Queues, workers, retries, idempotency, providers, reconciliation                 | Required before async workflows scale         |
| [`spec/15-observability-and-operations.md`](spec/15-observability-and-operations.md)                               | Logs, metrics, health checks, alerting, deployments, backups                     | Platform operations standard                  |
| [`spec/16-notifications-and-delivery.md`](spec/16-notifications-and-delivery.md)                                   | Notifications, delivery channels, preferences, quiet hours, retries              | Later automation phase                        |
| [`spec/17-ai-cost-quality-and-evaluation.md`](spec/17-ai-cost-quality-and-evaluation.md)                           | AI budgets, evaluations, model routing, quality gates, kill switches             | Required before broad AI automation           |

## 6. Current Delivery Roadmap

The roadmap follows domain dependencies rather than feature mockups.

```text
Phase 1
Core foundation
Status: completed with ongoing hardening
```

```text
Phase 2A
Interview workflow and Today execution
Status: current implementation milestone
```

```text
Phase 2B
Candidate Profile, Career Directions, Resume Versions, Work Authorization
Status: next domain foundation
```

```text
Phase 2C
Company, Canonical Job, Job Sources, Location/Remote Scope, Eligibility Inputs
Status: catalog foundation
```

```text
Phase 2D
Contextual Match Result and Jobs Workspace V2
Status: decision-support foundation
```

```text
Phase 3
AI interview assistance and Fast Capture
Status: follows stable manual workflow and AI governance
```

```text
Phase 4
Career Intelligence and longitudinal insights
Status: follows sufficient trustworthy historical data
```

```text
Phase 5
Notifications, calendar, browser extension, source-health automation
Status: follows stable background-job/integration infrastructure
```

Read [`roadmap.md`](roadmap.md) for phase exit criteria and exact sequencing.

## 7. Reading Paths

### Path A: Active Interview Development

For Phase 2A implementation:

1. Read [`roadmap.md`](roadmap.md).
2. Read [`spec/10-applications-workflow.md`](spec/10-applications-workflow.md).
3. Read [`spec/11-interviews-followups-today.md`](spec/11-interviews-followups-today.md).
4. Read [`spec/12-api-conventions.md`](spec/12-api-conventions.md).
5. Read [`spec/02-data-security-and-evolution.md`](spec/02-data-security-and-evolution.md).
6. Check [`current-status.md`](current-status.md) before changing existing models/routes.

### Path B: Career Directions and Profile

For Phase 2B:

1. Read [`spec/01-domain-architecture.md`](spec/01-domain-architecture.md).
2. Read [`spec/03-candidate-profile.md`](spec/03-candidate-profile.md).
3. Read [`spec/04-career-directions.md`](spec/04-career-directions.md).
4. Read [`spec/05-resume-versioning.md`](spec/05-resume-versioning.md).
5. Read [`spec/06-location-eligibility.md`](spec/06-location-eligibility.md).
6. Read [`spec/02-data-security-and-evolution.md`](spec/02-data-security-and-evolution.md).

### Path C: Jobs, Ingestion, and Matching

For Phase 2C and 2D:

1. Read [`spec/01-domain-architecture.md`](spec/01-domain-architecture.md).
2. Read [`spec/07-job-catalog-ingestion.md`](spec/07-job-catalog-ingestion.md).
3. Read [`spec/06-location-eligibility.md`](spec/06-location-eligibility.md).
4. Read [`spec/09-matching-ai-governance.md`](spec/09-matching-ai-governance.md).
5. Read [`spec/08-jobs-workspace-v2.md`](spec/08-jobs-workspace-v2.md).
6. Read [`spec/10-applications-workflow.md`](spec/10-applications-workflow.md).

### Path D: AI or Background Integrations

Before implementing any AI, parser, crawler, email, notification, or scheduled workflow:

1. Read [`spec/14-background-jobs-and-integration-reliability.md`](spec/14-background-jobs-and-integration-reliability.md).
2. Read [`spec/17-ai-cost-quality-and-evaluation.md`](spec/17-ai-cost-quality-and-evaluation.md).
3. Read [`spec/13-file-storage-and-resume-ingestion.md`](spec/13-file-storage-and-resume-ingestion.md) for resume/file work.
4. Read [`spec/15-observability-and-operations.md`](spec/15-observability-and-operations.md).
5. Read [`spec/02-data-security-and-evolution.md`](spec/02-data-security-and-evolution.md).

### Path E: New Contributor

1. Read this document.
2. Read [`current-status.md`](current-status.md).
3. Read [`spec/01-domain-architecture.md`](spec/01-domain-architecture.md).
4. Read [`spec/02-data-security-and-evolution.md`](spec/02-data-security-and-evolution.md).
5. Read the module spec for the task.
6. Read [`spec/12-api-conventions.md`](spec/12-api-conventions.md).
7. Read [`engineering-conventions.md`](engineering-conventions.md).

## 8. Documentation Authority

When documents conflict, apply this order:

1. [`spec/01-domain-architecture.md`](spec/01-domain-architecture.md) defines object meaning and relationship boundaries.
2. [`spec/02-data-security-and-evolution.md`](spec/02-data-security-and-evolution.md) defines security, ownership, migration, privacy, backup, and retention constraints.
3. Module specs define detailed behavior within those boundaries.
4. [`spec/12-api-conventions.md`](spec/12-api-conventions.md) defines shared implementation conventions.
5. [`roadmap.md`](roadmap.md) sequences work but does not redefine domain semantics.
6. [`current-status.md`](current-status.md) reports verified implementation; it does not override intended architecture.
7. An explicitly approved newer amendment supersedes earlier conflicting text only when it identifies the affected document and decision.

## 9. Documentation Maintenance Rules

### Update with delivery

When a milestone merges:

1. Update [`current-status.md`](current-status.md) with verified behavior, migration version, route changes, tests, and known limitations.
2. Update [`roadmap.md`](roadmap.md) status and remaining exit criteria.
3. Update the relevant module spec if the delivered behavior differs from approved contract.
4. Update API/architecture documentation for material route, schema, background-task, or deployment changes.

### Update with schema changes

Every Alembic migration must have:

```text
Relevant module spec update
Migration purpose
Data backfill plan if needed
Compatibility/rollback or forward-fix notes
Index/constraint explanation
Verification steps
```

Schema changes must be additive by default and must not delete users, password hashes, applications, resumes, interviews, or historical snapshots without an explicit reviewed retention plan.

### Update with API changes

Any API contract change must update:

```text
Relevant module specification
API conventions when the convention changes
Architecture documentation when boundaries change
Tests
Frontend client usage where applicable
```

### Update with AI changes

Any persisted AI behavior change must update:

```text
AI feature input/output contract
Prompt version
Model/provider version
Evaluation or regression result
User review/correction behavior
Cost/rate-limit implications
Fallback behavior
```

### Update with UI changes

Material UI behavior changes must preserve:

```text
Light/dark/system theme compatibility
Responsive behavior
Accessible keyboard/focus behavior
Unified control sizing
Consistent navigation/layout
Low cognitive-load interaction hierarchy
```

## 10. Documentation Naming Rules

Documentation files use:

```text
Markdown format: .md
Filename style: lowercase kebab-case
Directory names: lowercase kebab-case
```

Correct:

```text
career-directions.md
jobs-workspace-v2.md
data-security-and-evolution.md
phase-2a-interviews-and-today.md
```

Avoid:

```text
CAREER_DIRECTIONS_SPEC.md
Jobs_V2_SPEC.md
Product Roadmap.md
careerDirections.spec
```

## 11. Documentation Security Rules

Do not commit documentation containing:

```text
DATABASE_URL
Production credentials
Provider API keys
Password-reset URLs
Raw tokens
Session cookies
Passwords
Password hashes
Private user resume content
Private interview notes
Database dumps
Signed storage URLs
```

Use placeholders in documentation:

```text
DATABASE_URL=<redacted>
RESEND_API_KEY=<redacted>
TOKEN=<redacted>
```

## 12. Final Documentation Contract

The documentation system exists to make CareerNeed easier to evolve safely.

```text
Specs define what must be true.
Architecture defines boundaries.
Conventions define how changes are implemented.
Roadmap defines when work happens.
Current status defines what is verified today.
Tests verify behavior.
Migrations preserve data.
Operational docs make failures recoverable.
```

Every major feature should be understandable by reading its module spec, applicable security rules, API conventions, and current implementation status.
