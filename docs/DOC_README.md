# CareerNeed Documentation Center (`docs/`)

> This directory serves as the official technical, product design, and architectural documentation center for **CareerNeed**.  
> It consolidates the product vision, detailed specifications, engineering standards, architecture designs, and development roadmaps.

---

## 1. Core Vision & Product Philosophy

CareerNeed is an **AI-assisted career operating system and privacy-first job-search workspace** engineered for technical professionals.

> **North Star Mission**:  
> **"Help users spend less time recording, focus more on deliberate self-improvement, and receive actionable advice for every step of their career journey."**

CareerNeed moves beyond passive tracking tables, turning the job hunt into a structured, continuous growth loop:

```text
1. Resume Ingestion & AI Profiling
   ↓
2. Target Company Discovery & Auto-Sourcing
   ↓
3. Automated Job Crawling & JD/Resume Match Scoring
   ↓
4. Career Gap Diagnosis & Actionable Growth Roadmap
   ↓
5. Unified Job Pool & Application Lifecycle Tracking
   ↓
6. Multi-Round Interview Management & Fast Capture
   ↓
7. Per-Round AI-Assisted Interview Preparation
   ↓
8. Post-Interview Debrief & AI Failure Analysis
   ↓
9. Stage Snapshots, Backup & Long-Term Career Capital
```

---

## 2. Document Catalog

Every document in this directory addresses a specific dimension of the platform:

| Document | Nature | Purpose & Scope | Target Audience |
| :--- | :--- | :--- | :--- |
| **[CURRENT_STATUS.md](CURRENT_STATUS.md)** | Baseline | **Audited baseline of completed functionality**.<br>Detailed inventory of verified features: authentication, user isolation, resume management, skill extraction, ATS sync, job filters, Kanban board, application detail workspace, and BYOK LLM credentials. | All team members / New contributors |
| **[PRODUCT_SPEC.md](PRODUCT_SPEC.md)** | Specification | **Comprehensive Product Specification (v0.2)**.<br>End-to-end specifications covering first-use onboarding, target company recommendations, job matching/gap planning, interview data models, Fast Capture smart text ingestion, AI preparation, failure analysis, and stage snapshots. | Product / Full-stack / Architects |
| **[ROADMAP.md](ROADMAP.md)** | Roadmap | **Phased engineering implementation plan**.<br>Outlines milestone boundaries from Phase 1 (Foundation ✅) to the active **Phase 2 (Interview Management & Fast Capture 🎯)**, followed by AI coaching, onboarding profiling, and automation. | Engineering leads / Project managers / Devs |
| **[PRODUCT_REQUIREMENT.md](PRODUCT_REQUIREMENT.md)** | PRD | **Product Requirements Document (PRD v0.2)**.<br>Problem statement, user personas, end-to-end User Stories, functional specifications, and non-functional requirements (security, latency, offline resilience). | Product managers / QA / Developers |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | Architecture | **System Architecture & Technical Design**.<br>Detailed breakdown of Next.js client-side data loading, FastAPI routes, PostgreSQL row-level isolation, modular ATS connectors, LLM intelligence pipelines (Fast Capture, AI Prep, Failure Diagnosis), and ADRs. | Backend developers / Architects / Security |
| **[PROJECT_CONVINTIONS.md](PROJECT_CONVINTIONS.md)** | Conventions | **Engineering Standards & Design System Rules**.<br>Defines Tailwind semantic token mapping, accessible theme modes (System/Light/Dark), route hierarchy, REST/snake_case API contracts, AI structured response standards, and Definition of Done (DoD). | Frontend / Backend / Code reviewers |

---

## 3. Recommended Reading Paths

Depending on your role and current task, follow these reading sequences:

### Path A: Building New Features (Active Sprint: Interview Management & Fast Capture)
1. Read **[ROADMAP.md](ROADMAP.md)**: Identify Phase 2 deliverables and execution sequence.
2. Read **[PRODUCT_SPEC.md](PRODUCT_SPEC.md)** (specifically *Module 5: Interview Management* & *Data Model*): Learn the `interviews` schema, fields, and Fast Capture flow.
3. Read **[ARCHITECTURE.md](ARCHITECTURE.md)**: Understand the Fast Capture parsing pipeline and user-isolation query constraints.
4. Adhere to **[PROJECT_CONVINTIONS.md](PROJECT_CONVINTIONS.md)**: Follow semantic tokens, API naming conventions, and the Definition of Done checklist.

### Path B: Understanding Current Platform Capabilities
1. Review **[CURRENT_STATUS.md](CURRENT_STATUS.md)**: Inspect verified, production-ready features and known quality tasks.
2. Cross-reference **[ROADMAP.md](ROADMAP.md)**: See what is completed in Phase 1 vs. what is scheduled next.

### Path C: Product Planning & Feature Grooming
1. Review **[PRODUCT_REQUIREMENT.md](PRODUCT_REQUIREMENT.md)**: Confirm user stories, value hypotheses, and acceptance criteria.
2. Review **[PRODUCT_SPEC.md](PRODUCT_SPEC.md)**: Examine user interaction flows, data boundaries, and fallback policies.

---

## 4. Documentation Maintenance Rules

To keep documentation synchronized with the evolving codebase:

1. **Update Baseline on Delivery**: When a milestone (such as Phase 2 interview tracking) merges to main, immediately update `CURRENT_STATUS.md` and check off items in `ROADMAP.md`.
2. **Synchronize Schema & API Changes**: Any database schema change (Alembic migration) or API contract update must be reflected in `ARCHITECTURE.md` and `PROJECT_CONVINTIONS.md` within the same pull request.
3. **No Undocumented Conventions**: All design system changes, AI prompting conventions, or connector patterns must be recorded in the appropriate document.
