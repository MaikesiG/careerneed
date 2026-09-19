# CareerNeed Specification Center

> **Consolidation Date:** 2026-09-19  
> **Status:** Authoritative Repository Baseline  
> **Repository:** `careerneed`

Welcome to the official product, domain, architecture, and engineering specification center for **CareerNeed**. This documentation center establishes the authoritative product baseline, active implementation contracts, domain boundaries, and strategic delivery roadmap.

---

## 1. Documentation Map

The specification corpus is structured into eight functional sections and a historical archive:

```text
spec/
├── README.md                                          # Entry point and documentation governance (this document)
├── _SPEC_CONSOLIDATION_PLAN.md                        # Master consolidation audit, mapping, and decisions record
│
├── 00-product/                                        # Strategic Product Foundations
│   ├── vision-and-principles.md                       # Identity, North Star, pillars, and 10 core principles
│   ├── target-users-and-jtbd.md                       # Focused US/CA technical ICP, personas, and JTBD
│   ├── market-scope-and-global-portability.md         # Global portability, US/CA scope, and expansion gates
│   ├── roadmap-and-dependencies.md                    # Single authoritative primary roadmap (Phases 0–6)
│   └── metrics-and-decision-framework.md              # North Star metric, pillar KPIs, and 7-question framework
│
├── 01-domain/                                         # Domain Models & Invariants
│   ├── domain-model-and-ownership.md                  # Canonical domain entities, relationships, and data ownership
│   ├── career-directions.md                           # Durable user-owned career planning object (Phase 4 dep)
│   ├── lifecycle-and-state-transitions.md             # State machines, application timeline, and snapshots
│   └── private-data-ai-artifact-lifecycle.md          # AI artifact lifecycle and explicit-confirmation write model
│
├── 02-current-product/                                # Shipped & Active Implementation Contracts
│   ├── README.md                                      # Active capability and implementation status matrix
│   ├── jobs-and-job-sources.md                        # Job catalog, multi-ATS connectors, and jobs workspace
│   ├── applications.md                                # Application tracking, pipeline board, and detail workspace
│   ├── interviews-and-preparation.md                  # Multi-round interviews, participants, and question debriefs
│   ├── contacts-follow-ups-and-todos.md               # Reusable contacts, follow-up actions, and Today dashboard
│   └── resumes.md                                     # Resume management, PDF ingestion, and version snapshots
│
├── 03-ai/                                             # Controlled AI Architecture
│   ├── ai-principles-and-safety.md                    # Safety principles, data minimization, and advisory boundaries
│   ├── controlled-ai-architecture.md                  # Server-side routing, provider selection policy, and audit schema
│   ├── interview-preparation-brief.md                 # First AI feature: application-grounded preparation brief
│   └── future-ai-search.md                            # Natural-language career search architecture and gating
│
├── 04-future-modules/                                 # Roadmap Modules (Phases 3–6)
│   ├── career-memory-and-imports.md                   # CSV/Markdown/TXT import pipeline and provenance
│   ├── opportunity-watch-and-routines.md              # Opportunity Watch rules, alert engine, and Career Routines
│   ├── resume-aware-matching.md                       # Contextual matching engine, eligibility, and explainability
│   ├── career-intelligence-community.md              # Task-driven community, destinations, and contribution flow
│   └── incentives-petcoin-pets-badges.md              # PetCoin closed-loop credit, Career Pets, and non-pay-to-win badges
│
├── 05-trust-privacy/                                  # Security, Privacy & Compliance Standards
│   ├── privacy-ownership-and-export.md                # Private-by-default rules, data export, and deletion guarantees
│   ├── security-import-safety-and-prompt-injection.md # Safe file parsing, sandbox isolation, and injection defense
│   └── community-trust-moderation-and-anti-abuse.md  # Pre-moderation, anti-farming, and internal trust scores
│
├── 06-architecture/                                   # System Architecture & Operational Standards
│   ├── system-boundaries-and-integration-principles.md # Web/API/DB boundaries and anti-complexity rules
│   ├── api-and-data-conventions.md                    # REST conventions, safe 404s, migrations, and file storage
│   ├── frontend-architecture-and-quality.md           # Next.js boundaries, four-tier state ownership, and accessibility
│   ├── background-work-and-integration-reliability.md # Timeouts, retries, error normalization, and deferred queues
│   ├── search-retrieval-and-authorization-boundaries.md # Pre-retrieval authorization and citation generation
│   ├── notifications-and-alert-policy.md              # In-app-first alert policy, quiet hours, and suppression
│   └── observability-audit-and-cost-controls.md       # Correlation logging, health checks, runbooks, and budgets
│
├── 07-decisions/                                      # Architecture Decision Records (ADRs)
│   ├── README.md                                      # ADR registry and format guidelines
│   └── ADR-0001-product-scope-and-phasing.md          # Record: Product Scope, Initial Technical ICP, and Roadmap
│
└── 99-archive/                                        # Historical Archive (Superseded Documents)
    ├── README.md                                      # Archive catalog, deletion records, and supersession mapping
    └── [historical specs preserved with banners]     # Historical reference specs
```

---

## 2. Market Scope and Global Portability Baseline

CareerNeed enforces a clear distinction between data portability and operational market scope:
1. **Long-Term Direction**: A **globally portable**, user-owned career operating system. The candidate's career data, resumes, applications, and reflections follow them permanently regardless of geographic moves.
2. **Current Product Language**: **English-first**. All system interfaces, schemas, and AI prompts operate primarily in English.
3. **Current Operating Market**: **United States and Canada (US/CA)**. Job catalogs, ATS connectors, location hierarchies, and compensation metadata focus on North American technical hiring.
4. **Initial Wedge**: **Technical Job Seekers** (Software Engineering, AI/ML Engineering, Data & Analytics, Platform/DevOps/SRE).
5. **Portability vs Operation**: Global data portability does **not** imply worldwide operational support or localized ATS ingestion today. Wording presenting US-only scope as the absolute product boundary is corrected to reflect US/CA operational market and global career record portability.

---

## 3. Specification Status Vocabulary

Every active document in this repository uses a standardized status label in its metadata header:

| Status Label | Definition | Implementation Stance |
|---|---|---|
| **Implemented** | The specification describes functionality that is completely implemented, verified by automated tests, and running in production code. | Stable contract; modifications require formal regression review. |
| **In progress** | The specification describes active development work in the current phase. Core interfaces are established but extensions or polish are underway. | Active working contract; subject to minor refinement. |
| **Planned** | The specification defines an approved feature or architecture planned for an upcoming milestone according to roadmap dependencies. | Authoritative target; implementation must not begin before prerequisite phases exit. |
| **Deferred** | The capability is strategically recognized but explicitly deprioritized for near-term milestones. | Documented design; no active code or infrastructure dependencies permitted. |
| **Non-goal** | The feature, architecture, or behavior is intentionally rejected to preserve product focus, safety, or simplicity. | Strictly prohibited; any implementation proposal will be rejected. |

---

## 4. Order of Authority

When architectural, product, or implementation conflicts arise across documents, the following order of precedence strictly governs:

1. **Strategic Baseline**: [`00-product/vision-and-principles.md`](00-product/vision-and-principles.md) and [`00-product/roadmap-and-dependencies.md`](00-product/roadmap-and-dependencies.md) define the product identity, ICP, non-goals, and phasing constraints.
2. **Market Scope & Portability**: [`00-product/market-scope-and-global-portability.md`](00-product/market-scope-and-global-portability.md) governs geographic hierarchy, timezones, currency, and international expansion gates.
3. **Domain Invariants**: [`01-domain/domain-model-and-ownership.md`](01-domain/domain-model-and-ownership.md) and [`01-domain/career-directions.md`](01-domain/career-directions.md) define canonical domain entities, relationships, ownership boundaries, and the prohibition of parallel subsystems.
4. **Security & Privacy Standards**: [`05-trust-privacy/privacy-ownership-and-export.md`](05-trust-privacy/privacy-ownership-and-export.md) and [`03-ai/ai-principles-and-safety.md`](03-ai/ai-principles-and-safety.md) define non-negotiable data isolation, credential boundaries, and explicit write confirmation.
5. **Architecture & Engineering Standards**: [`06-architecture/api-and-data-conventions.md`](06-architecture/api-and-data-conventions.md), [`06-architecture/frontend-architecture-and-quality.md`](06-architecture/frontend-architecture-and-quality.md), and [`06-architecture/background-work-and-integration-reliability.md`](06-architecture/background-work-and-integration-reliability.md) govern engineering rules and integration boundaries.
6. **Active Capability Registry**: [`02-current-product/README.md`](02-current-product/README.md) governs the active implementation status of all capabilities.
7. **Module Specifications**: Individual specs in `02-current-product/`, `03-ai/`, and `04-future-modules/` govern specific functional behavior within their architectural boundaries.
8. **Architecture Decision Records (ADRs)**: [`07-decisions/`](07-decisions/README.md) document specific architectural choices and trade-offs.
9. **Historical Archive**: Documents in [`99-archive/`](99-archive/README.md) have zero authority and serve only as historical provenance.

---

## 5. Reading Paths by Contributor Role

### Path 1: Product Owner & Strategic Leadership
1. [`00-product/vision-and-principles.md`](00-product/vision-and-principles.md) — Product mission, pillars, and 10 core principles.
2. [`00-product/market-scope-and-global-portability.md`](00-product/market-scope-and-global-portability.md) — Global portability, US/CA scope, and expansion gates.
3. [`00-product/target-users-and-jtbd.md`](00-product/target-users-and-jtbd.md) — Focused US/CA technical ICP and jobs-to-be-done.
4. [`00-product/roadmap-and-dependencies.md`](00-product/roadmap-and-dependencies.md) — Phasing sequence and strict non-goals.
5. [`00-product/metrics-and-decision-framework.md`](00-product/metrics-and-decision-framework.md) — North Star and 7-question feature gate.
6. [`02-current-product/README.md`](02-current-product/README.md) — Active capability and status matrix.

### Path 2: Core Backend & Database Engineers
1. [`01-domain/domain-model-and-ownership.md`](01-domain/domain-model-and-ownership.md) — Canonical entities, relationships, and user scoping.
2. [`01-domain/career-directions.md`](01-domain/career-directions.md) — Career direction entity and downstream consumers.
3. [`01-domain/lifecycle-and-state-transitions.md`](01-domain/lifecycle-and-state-transitions.md) — State machines, snapshots, and event timelines.
4. [`06-architecture/api-and-data-conventions.md`](06-architecture/api-and-data-conventions.md) — REST patterns, safe 404s, migrations, and file storage.
5. [`06-architecture/background-work-and-integration-reliability.md`](06-architecture/background-work-and-integration-reliability.md) — Integration timeouts, retries, and deferred queues.
6. [`05-trust-privacy/privacy-ownership-and-export.md`](05-trust-privacy/privacy-ownership-and-export.md) — Object-level authorization and soft-delete semantics.

### Path 3: Frontend & Full-Stack Engineers
1. [`06-architecture/frontend-architecture-and-quality.md`](06-architecture/frontend-architecture-and-quality.md) — Next.js boundaries, state ownership, and accessibility.
2. [`06-architecture/api-and-data-conventions.md`](06-architecture/api-and-data-conventions.md) — API error shapes and pagination standards.
3. [`02-current-product/jobs-and-job-sources.md`](02-current-product/jobs-and-job-sources.md) — Jobs workspace layout and URL filter contracts.
4. [`02-current-product/applications.md`](02-current-product/applications.md) — Application List and Pipeline Board.
5. [`02-current-product/interviews-and-preparation.md`](02-current-product/interviews-and-preparation.md) — Interview rounds, participant modal, and debrief notes.
6. [`02-current-product/contacts-follow-ups-and-todos.md`](02-current-product/contacts-follow-ups-and-todos.md) — Today dashboard action hierarchy.

### Path 4: AI & Machine Learning Engineers
1. [`03-ai/ai-principles-and-safety.md`](03-ai/ai-principles-and-safety.md) — AI safety, privacy minimization, and user confirmation write model.
2. [`03-ai/controlled-ai-architecture.md`](03-ai/controlled-ai-architecture.md) — Server-side routing, provider selection policy, and audit schema.
3. [`03-ai/interview-preparation-brief.md`](03-ai/interview-preparation-brief.md) — Grounded preparation brief specification.
4. [`01-domain/private-data-ai-artifact-lifecycle.md`](01-domain/private-data-ai-artifact-lifecycle.md) — Draft, review, edit, and apply states.
5. [`06-architecture/observability-audit-and-cost-controls.md`](06-architecture/observability-audit-and-cost-controls.md) — AI cost tracking and emergency kill switches.

---

## 6. Specification Change Process

All modifications to specifications must follow this change control process:

1. **Additive Schema & Spec Updates**: Changes to data models, API endpoints, or user-facing states must update the corresponding specification in `02-current-product/`, `01-domain/`, or `06-architecture/` before code merges.
2. **Roadmap & Strategic Modifications**: Modifying delivery phases, ICP definitions, or product pillars requires an updated Architecture Decision Record in `07-decisions/` approved by the Product Owner.
3. **No Unilateral Documentation Overrides**: Documentation changes cannot bypass security standards, relax tenant isolation, or introduce unapproved external integrations without formal architectural review.
4. **Archival Integrity**: Superseded documents must never be modified in place; they must be moved to `99-archive/` with a complete deprecation banner indicating the superseding document and reason.

---

## 7. When to Create a New Spec

To maintain high documentation quality and prevent specification sprawl:
- **Create a New Spec ONLY if**:
  1. A capability introduces an **independent lifecycle** or distinct state machine;
  2. A capability establishes a new **authorization boundary** or tenancy model;
  3. A capability introduces a distinct **canonical data model**;
  4. A capability introduces unique **operational risks** (e.g. third-party provider costs, security exposures); OR
  5. A capability represents a defined **rollout gate** with distinct entry/exit criteria.
- **Otherwise, Update the Existing Authoritative Doc**: Incremental features, additive schema fields, filter parameters, and UI improvements must update the existing authoritative specification rather than creating fragmented side documents.
- **Use ADRs for Cross-Cutting Decisions**: Durable strategic choices, technology selections, and architectural trade-offs that cut across multiple subsystems must be recorded as Architecture Decision Records in [`07-decisions/`](07-decisions/README.md).
