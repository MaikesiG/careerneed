# CareerNeed Specification Consolidation Plan (Amended)

> **Date:** 2026-09-19  
> **Status:** Active Working Plan (Amended Baseline)  
> **Purpose:** Audit, map, and guide the consolidation of all specification documents in `spec/` to achieve complete internal consistency with the Authoritative Product Baseline, market scope corrections, active engineering standards extraction, and domain object definitions.

---

## 1. Complete Document Inventory (Phase A Audit)

An exhaustive audit of all 26 Markdown documents originally residing under `spec/`:

| # | Original Path | Size | Nature / Type | Original Content / Purpose Summary | Recommended Disposition |
|---|---|---|---|---|---|
| 1 | `spec/00-global-product.md` | 6 KB | Strategic Overview | High-level product mission, modules, and old 5-phase delivery model. | **Archived & Superseded** → `spec/99-archive/00-global-product.md` (superseded by `00-product/vision-and-principles.md` & `00-product/roadmap-and-dependencies.md`) |
| 2 | `spec/01-domain-architecture.md` | 6 KB | Domain Architecture | Core canonical objects, relationships, and historical snapshot rules. | **Archived & Superseded** → `spec/99-archive/01-domain-architecture.md` (superseded by `01-domain/domain-model-and-ownership.md`) |
| 3 | `spec/02-data-security-and-evolution.md` | 4 KB | Platform Security Standard | Data security, object-level authorization, soft delete, backups, and migration patterns. | **Archived & Superseded** → `spec/99-archive/02-data-security-and-evolution.md` (superseded by `05-trust-privacy/privacy-ownership-and-export.md` & `06-architecture/api-and-data-conventions.md`) |
| 4 | `spec/03-candidate-profile.md` | 0 B | Empty Placeholder | Empty 0-byte file representing candidate profile. | **Deleted** on 2026-09-19 (Empty stub; Candidate Profile authoritatively specified in `01-domain/domain-model-and-ownership.md`) |
| 5 | `spec/04-career-directions.md.md` | 43 KB | Detailed Spec (Malformed name) | Exhaustive spec on Career Directions, taxonomy, models, and API. Included sales, marketing, finance. | **Archived & Superseded** → `spec/99-archive/04-career-directions.md` (Active technical career direction model extracted to `01-domain/career-directions.md`) |
| 6 | `spec/05-resume-versioning.md` | 2 KB | Domain Spec | Resume artifacts, immutable versions, application snapshots. | **Archived & Superseded** → `spec/99-archive/05-resume-versioning.md` (superseded by `02-current-product/resumes.md` & `01-domain/lifecycle-and-state-transitions.md`) |
| 7 | `spec/06-location-eligibility.md.md` | 32 KB | Detailed Spec (Malformed name) | Location hierarchy, remote scope, work arrangement, sponsorship, and eligibility evaluation engine. | **Archived & Superseded** → `spec/99-archive/06-location-eligibility.md` (superseded by `04-future-modules/resume-aware-matching.md` & `00-product/market-scope-and-global-portability.md`) |
| 8 | `spec/07-job-catalog-ingestion.md` | 3 KB | Domain/Catalog Spec | Companies, canonical jobs, job sources, deduplication, and lifecycle. | **Archived & Superseded** → `spec/99-archive/07-job-catalog-ingestion.md` (superseded by `02-current-product/jobs-and-job-sources.md`) |
| 9 | `spec/08-jobs-workspace-v2.md.md` | 35 KB | UX & API Spec (Malformed name) | Direction-aware Jobs page, desktop/mobile responsive layouts, filters, and query pipeline. | **Archived & Superseded** → `spec/99-archive/08-jobs-workspace-v2.md` (superseded by `02-current-product/jobs-and-job-sources.md`) |
| 10 | `spec/09-matching-ai-governance.md` | 4 KB | Governance Spec | Match Result principles, eligibility vs score, AI suggestions, and review requirements. | **Archived & Superseded** → `spec/99-archive/09-matching-ai-governance.md` (superseded by `03-ai/ai-principles-and-safety.md` & `04-future-modules/resume-aware-matching.md`) |
| 11 | `spec/10-applications-workflow.md` | 3 KB | Workflow Spec | Application state machine, event timeline, idempotency, and concurrency. | **Archived & Superseded** → `spec/99-archive/10-applications-workflow.md` (superseded by `02-current-product/applications.md` & `01-domain/lifecycle-and-state-transitions.md`) |
| 12 | `spec/11-interviews-followups-today.md` | 4 KB | Workflow Spec | Interviews, contacts, questions, LeetCode links, follow-ups, and Today action priorities. | **Archived & Superseded** → `spec/99-archive/11-interviews-followups-today.md` (superseded by `02-current-product/interviews-and-preparation.md` & `02-current-product/contacts-follow-ups-and-todos.md`) |
| 13 | `spec/12-api-conventions.md` | 5 KB | Engineering Standard | REST conventions, validation, pagination, idempotency, and timestamp rules. | **Archived & Superseded** → `spec/99-archive/12-api-conventions.md` (Active requirements migrated into `06-architecture/api-and-data-conventions.md`) |
| 14 | `spec/13-file-storage-and-resume-ingestion.md` | 13 KB | Technical Spec | Private file uploads, validation, storage keys, scanning, and resume text extraction. | **Archived & Superseded** → `spec/99-archive/13-file-storage-and-resume-ingestion.md` (Active requirements migrated into `06-architecture/api-and-data-conventions.md` & `04-future-modules/career-memory-and-imports.md`) |
| 15 | `spec/14-background-jobs-and-integration-reliability.md` | 12 KB | Technical Architecture | Background worker tasks, idempotency keys, retries, circuit breakers, and provider controls. | **Archived & Superseded** → `spec/99-archive/14-background-jobs-and-integration-reliability.md` (Active requirements migrated into `06-architecture/background-work-and-integration-reliability.md`) |
| 16 | `spec/15-observability-and-operations.md` | 9 KB | Operations Spec | Structured logging, metrics, liveness/readiness health checks, runbooks, backups, and restore drills. | **Archived & Superseded** → `spec/99-archive/15-observability-and-operations.md` (superseded by `06-architecture/observability-audit-and-cost-controls.md`) |
| 17 | `spec/16-notifications-and-delivery.md` | 8 KB | Future Module Spec | In-app notifications, delivery channels, preferences, quiet hours, and suppression. | **Archived & Superseded** → `spec/99-archive/16-notifications-and-delivery.md` (superseded by `06-architecture/notifications-and-alert-policy.md`) |
| 18 | `spec/17-ai-cost-quality-and-evaluation.md` | 11 KB | AI Architecture Spec | AI provider routing, prompt/model versioning, quality evaluation datasets, budgets, and kill switches. | **Archived & Superseded** → `spec/99-archive/17-ai-cost-quality-and-evaluation.md` (superseded by `03-ai/controlled-ai-architecture.md` & `06-architecture/observability-audit-and-cost-controls.md`) |
| 19 | `spec/18-product-roadmap.md` | 18 KB | Delivery Roadmap | Outdated 5-phase delivery sequencing (Phase 1, 2A-2D, 3, 4, 5). | **Archived & Superseded** → `spec/99-archive/18-product-roadmap.md` (superseded by `00-product/roadmap-and-dependencies.md`) |
| 20 | `spec/19-frontend-architecture-and-quality.md` | 22 KB | Frontend Architecture | Next.js architecture, state ownership (Server, URL, Form, UI), TanStack Query, React Hook Form. | **Archived & Superseded** → `spec/99-archive/19-frontend-architecture-and-quality.md` (Active requirements migrated into `06-architecture/frontend-architecture-and-quality.md`) |
| 21 | `spec/CURRENT_STATUS.md` | 8 KB | Implementation Baseline | Implementation inventory as of 2026-09-17. | **Archived & Superseded** → `spec/99-archive/CURRENT_STATUS.md` (Superseded by `02-current-product/README.md`) |
| 22 | `spec/conventions.md` | 28 KB | Engineering Standards | Comprehensive coding, API, UI, database, AI, and documentation rules. | **Archived & Superseded** → `spec/99-archive/conventions.md` (Active rules migrated into `06-architecture/api-and-data-conventions.md` & `06-architecture/frontend-architecture-and-quality.md`) |
| 23 | `spec/product-requirements.md` | 21 KB | Product PRD v1.0 | User problems, personas, user stories, and acceptance criteria based on old roadmap. | **Archived & Superseded** → `spec/99-archive/product-requirements.md` (superseded by `00-product/target-users-and-jtbd.md` & `00-product/vision-and-principles.md`) |
| 24 | `spec/productv2.0.md` | 32 KB | Duplicate File | Exact byte-for-byte MD5 duplicate of `06-location-eligibility.md.md`. | **Archived & Superseded** → `spec/99-archive/productv2.0.md` (Duplicate of `06-location-eligibility.md`) |
| 25 | `spec/resume-matching.md` | 22 KB | Detailed Engine Spec | Contextual matching engine v3.0, inputs, dimensions, scoring math, explainability schema. | **Archived & Superseded** → `spec/99-archive/resume-matching.md` (superseded by `04-future-modules/resume-aware-matching.md`) |
| 26 | `spec/spec-readme.md` | 18 KB | Old Documentation Index | Outdated directory layout and reading paths referencing missing directories. | **Archived & Superseded** → `spec/99-archive/spec-readme.md` (superseded by `spec/README.md`) |

---

## 2. Market Scope Correction & Global Portability

### Authoritative Market Scope Definition
1. **Long-Term Direction**: A **globally portable**, user-owned career operating system. A candidate’s career records, skills, applications, and reflections should belong to them throughout their lifetime regardless of international moves, employer changes, or geographic relocation.
2. **Current Product Language**: **English-first**. All system interfaces, data schemas, default taxonomies, and AI interaction prompts operate primarily in English. (Multilingual UI is planned for future international expansions).
3. **Current Initial Operating Market**: **United States and Canada (US/CA)**. Job sources, location normalization, compensation conventions, and work authorization preferences focus on North American technical hiring.
4. **Initial Wedge**: **Technical Job Seekers** (Software Engineering, AI/ML Engineering, Data Engineering/Analytics, Platform/SRE).
5. **Boundary Clarification**: Global portability is a core architectural invariant for candidate-owned data, but it does **not** imply worldwide operational support, global ATS ingestion, or localized compliance today. Wording presenting US-only scope as the absolute product boundary is corrected to reflect US/CA operational market and global career record portability.

---

## 3. Engineering Standards Extraction (No Abandoned Standards)

Rather than archiving engineering standards without preserving their active operational contracts, the following three active architecture documents are added:

1. **`spec/06-architecture/api-and-data-conventions.md`**:
   - Owner-scoped authorization and safe 404 behavior (never leak entity existence across users).
   - Input validation and safe error response boundaries (standardized detail/code envelope).
   - Deterministic pagination (offset standard), idempotency keys, state transitions, UTC timestamps, and additive Alembic migrations.
   - Private file storage, file type/size validation, safe stream parsing, download authorization, soft deletion, provenance, and safe export formats.
2. **`spec/06-architecture/frontend-architecture-and-quality.md`**:
   - Next.js App Router server vs client component boundaries.
   - Four-tier state ownership (Server State via TanStack Query, URL State, Form State via React Hook Form + Zod, Local UI State via React `useState`).
   - Standardized Loading, Error, and Empty states.
   - Web accessibility (WCAG 2.1 AA, keyboard navigation, contrast ratios).
   - Safe AI text rendering (React JSX auto-escaping, sanitized markdown AST, zero `dangerouslySetInnerHTML`).
3. **`spec/06-architecture/background-work-and-integration-reliability.md`**:
   - Integration timeouts, idempotency, and safe retry boundaries with exponential backoff.
   - Provider error normalization into internal safe error codes.
   - Observability correlation (`request_id`, `trace_id`) and secret redaction.
   - **Infrastructure Stance**: Celery, RabbitMQ, Redis queues, and distributed circuit breakers are explicitly marked as **Deferred / Conditional** architecture choices for future scale, not immediate requirements for MVP phases. Synchronous executions with bounded timeouts govern early phases.

---

## 4. Career Directions Domain Boundary

**Architectural Invariant**: Career Directions must **NOT** be merged into Opportunity Watch.

Career Direction is an independent, durable user-owned planning object specified in:
`spec/01-domain/career-directions.md` (Status: `Planned — Phase 4 dependency`).

- **Domain Role**: Represents "What I want to pursue" (target roles, seniority bands, location preferences, work arrangement, compensation expectations).
- **Informs Multiple Subsystems**:
  1. Resume Version targeting (which resume version presents evidence for this direction).
  2. Match Result evaluation (evaluates job alignment against this direction).
  3. Opportunity Watch (consumes direction rules to filter incoming ATS jobs).
  4. Career Routines and future career planning.
- **Separation**: Opportunity Watch is a consumer of Career Direction, not its owner.

---

## 5. Configuration-Controlled AI Provider-Selection Policy

**Replacing Provider-Specific "Open Decision 1"**:
Long-lived specifications must not be permanently hard-coded to ephemeral model versions.

### Authoritative Provider-Selection Policy
1. **Configuration-Controlled Routing**: The active model provider and model version are controlled via environment and platform secret configuration, not hard-coded in domain logic.
2. **One Provider Validated at a Time**: Providers are integrated sequentially. Each adapter must pass automated structured-output schema tests and controlled smoke tests before production traffic is routed.
3. **Current State**: The OpenAI structured-output adapter is currently **In progress** pending one controlled smoke test and a limited real-use evaluation period.
4. **Conditional Second Provider**: Any evaluation or integration of a second provider is strictly conditional on evidence gathered from quality, schema adherence, latency, failure rate, cost, action value, availability, and operational risk during real-use evaluation. No specific future provider is pre-selected as the automatic next step.
5. **Strict Provider Distinction**: Groq and xAI/Grok are completely distinct providers with separate infrastructure, base URLs, and SDKs. They must never be conflated.
6. **Credential Boundaries**: AI credentials are server-side only (ignored local environment configuration in development; platform-managed secrets in production). Credentials must never be browser-exposed, committed, logged, or persisted in application database records.

---

## 6. Active Capability & Status Index

A central capability index is established at:
`spec/02-current-product/README.md`

It tracks the active implementation status across all core capabilities (Jobs, Applications, Interviews, Participants, Questions, Follow-ups, Resumes, AI Routing, Interview Preparation Brief, Career Memory, AI Search, Career Directions, Resume-aware Matching, Job Watch, Community, PetCoin).

---

## 7. Revised Target Documentation Structure

```text
spec/
├── README.md                                                  [Primary Documentation Center Entrypoint]
├── _SPEC_CONSOLIDATION_PLAN.md                                [This Master Plan Artifact]
│
├── 00-product/                                                [Strategic Product Foundations]
│   ├── vision-and-principles.md
│   ├── target-users-and-jtbd.md
│   ├── market-scope-and-global-portability.md                 [Active: US/CA scope, portability, expansion gates]
│   ├── roadmap-and-dependencies.md                            [Single Authoritative Primary Roadmap: Phases 0–6]
│   └── metrics-and-decision-framework.md
│
├── 01-domain/                                                 [Domain Models & Invariants]
│   ├── domain-model-and-ownership.md
│   ├── career-directions.md                                   [Active: Durable planning object, Phase 4 dep]
│   ├── lifecycle-and-state-transitions.md
│   └── private-data-ai-artifact-lifecycle.md
│
├── 02-current-product/                                        [Current Shipped & In-Progress Capabilities]
│   ├── README.md                                              [Active Capability & Status Matrix]
│   ├── jobs-and-job-sources.md
│   ├── applications.md
│   ├── interviews-and-preparation.md
│   ├── contacts-follow-ups-and-todos.md
│   └── resumes.md
│
├── 03-ai/                                                     [Controlled AI Architecture]
│   ├── ai-principles-and-safety.md
│   ├── controlled-ai-architecture.md
│   ├── interview-preparation-brief.md
│   └── future-ai-search.md
│
├── 04-future-modules/                                         [Roadmap Capabilities]
│   ├── career-memory-and-imports.md
│   ├── opportunity-watch-and-routines.md
│   ├── resume-aware-matching.md
│   ├── career-intelligence-community.md
│   └── incentives-petcoin-pets-badges.md
│
├── 05-trust-privacy/                                          [Security, Privacy & Anti-Abuse]
│   ├── privacy-ownership-and-export.md
│   ├── security-import-safety-and-prompt-injection.md
│   └── community-trust-moderation-and-anti-abuse.md
│
├── 06-architecture/                                           [System Design & Engineering Standards]
│   ├── system-boundaries-and-integration-principles.md
│   ├── api-and-data-conventions.md                            [Active: Migrated API/DB/storage standards]
│   ├── frontend-architecture-and-quality.md                   [Active: Migrated Next.js/state/a11y standards]
│   ├── background-work-and-integration-reliability.md         [Active: Migrated retry/idempotency standards]
│   ├── search-retrieval-and-authorization-boundaries.md
│   ├── notifications-and-alert-policy.md
│   └── observability-audit-and-cost-controls.md
│
├── 07-decisions/                                              [Architecture Decision Records]
│   ├── README.md
│   └── ADR-0001-product-scope-and-phasing.md
│
└── 99-archive/                                                [Historical Reference Archive]
    ├── README.md                                              [Records deletion of 03-candidate-profile.md]
    └── [25 historical specs preserved with standard archive banners]
```

---

## 8. Open Decisions (Updated)

### Open Decision 1: Initial Structured Output AI Provider Validation
- **Decision Question**: What is the current validation status and expansion policy for external AI model providers?
- **Policy**:
  1. Provider and model selection is configuration-controlled via environment and platform secrets.
  2. The OpenAI structured-output adapter is currently **In progress** pending one controlled smoke test and a limited real-use evaluation period.
  3. Any evaluation or integration of a second provider is strictly conditional on evidence gathered from quality, schema adherence, latency, failure rate, cost, action value, availability, and operational risk.
  4. Groq and xAI/Grok are recognized as distinct providers and must not be conflated. No particular future provider is named as the default next step.
- **Dependency**: Phase 1 AI Infrastructure & Evaluation Test Harness.
- **Owner**: AI Platform Engineering Lead.

### Open Decision 2: In-App Notification Delivery Storage Engine
- **Decision Question**: Should in-app notification state for Opportunity Watch and Career Routines be modeled as standard relational rows in PostgreSQL, or stored via an embedded caching mechanism?
- **Recommended Default**: PostgreSQL relational table (`notifications` and `notification_deliveries`) to maintain transactional integrity, foreign-key relationships to Applications/Jobs, and zero new infrastructure dependencies.
- **Dependency**: Phase 2 Action Center & Phase 4 Opportunity Watch.
- **Owner**: Backend Engineering Lead.

### Open Decision 3: Imported Career Memory File Storage Decision
- **Decision Question**: Where and how should raw imported career history files (CSV, Markdown, TXT) and resume uploads be stored?
- **Policy & Architecture**:
  1. **Local Development**: Ignored local storage paths (e.g. `uploads/`, git-ignored) used strictly for non-production test data.
  2. **Production**: Private object storage (e.g. S3-compatible) or platform-managed encrypted persistent storage accessed strictly behind an abstract `StorageService` interface.
  3. **Security Invariants**:
     - Strict owner authorization on all read and write paths.
     - Generated non-enumerable object keys (UUID-based paths; no public buckets/containers).
     - Deletion and 30-day recovery retention controls matching user data lifecycle.
     - Safe delivery via authenticated streaming or short-lived signed URLs.
     - Future malware and content scanning policy hook before file processing.
  4. **Deployment Flexibility**: The final provider and storage mechanism choice remains open until production infrastructure topology is finalized.
- **Dependency**: Phase 3 Career Memory and Imports.
- **Owner**: Platform Security Lead.
