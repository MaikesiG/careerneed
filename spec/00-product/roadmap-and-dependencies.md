# CareerNeed Authoritative Strategic Roadmap and Dependencies

> **Status:** Authoritative Strategic Roadmap  
> **Owner:** CareerNeed Product & Engineering  
> **Last Updated:** 2026-09-19  
> **Scope:** Authoritative 6-phase strategic roadmap (Phases 0–6), dependency gating, exit criteria, risks, and explicit deferrals.  
> **Authority:** This document is the single primary roadmap document for the entire CareerNeed repository. It defines the phased execution sequence, strict dependency gates, exit criteria, risks, and explicit deferrals. It supersedes all legacy roadmap versions.

---

## 1. Roadmap Architecture Principles

1. **Dependencies Precede Features**: We do not build AI recommendations before data structures exist, and we do not build community sharing before private records are secure.
2. **Milestones, Not Calendar Guarantees**: Phases represent verified architectural and product milestones governed by exit criteria, never arbitrary calendar deadlines.
3. **Evidence-Gated Progression**: A phase cannot exit until its automated tests pass, its data models are verified, and its operational observability is proven.
4. **The "Not Now" Discipline**: Features outside the active phase are strictly blocked from creeping into current sprints.

---

## 2. Global Phasing Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CAREERNEED STRATEGIC ROADMAP PHASING                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 0: Stabilize Execution System                                         │
│ Reliable core CRUD: Jobs, Applications, Interviews, Questions, Todos.       │
│ Status: Implemented / Hardening                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                      ↓                                      │
│ Phase 1: Controlled AI                                                      │
│ Application-grounded Interview Prep Brief, post-interview debrief, routing.  │
│ Status: In Progress                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                      ↓                                      │
│ Phase 2: Daily Career Rhythm                                                │
│ Action Center / Todo aggregation, Career Routines, timeline, Direct Search. │
│ Status: Planned                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                      ↓                                      │
│ Phase 3: Career Memory and AI Search                                        │
│ CSV/MD/TXT import pipeline, mapping, provenance, grounded AI Career Search. │
│ Status: Planned                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                      ↓                                      │
│ Phase 4: Proactive Opportunity Discovery                                    │
│ Career Directions, Resume Versions, resume-aware matching, Job Watch.       │
│ Status: Planned                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                      ↓                                      │
│ Phase 5: Career Intelligence Community                                      │
│ Anonymized contribution, pre-moderation, Interview Lab, insight-to-action.  │
│ Status: Planned                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                      ↓                                      │
│ Phase 6: Incentives and Ecosystem Expansion                                 │
│ PetCoin closed-loop credits, Career Pets, badges, compensation desk.        │
│ Status: Planned                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Phase Specifications

### Phase 0: Stabilize Execution System
- **Purpose**: Establish an rock-solid, user-isolated foundation for core job-search tracking. Ensure that manual workflows for jobs, applications, multi-round interviews, participants, questions, reflections, and follow-ups are completely reliable, tested, and accessible.
- **Dependencies**: None. Core system baseline.
- **Capabilities Delivered**:
  - User identity, bcrypt hashing, session cookies, and password reset.
  - Multi-source ATS job ingestion (Ashby, Greenhouse, Lever, Manual) with deduplication by `(source, external_job_id)`.
  - Application lifecycle management with dual views: List and Kanban Board (`/applications/board`).
  - Application detail workspace with Status Editor, Notes Editor, Follow-up Editor, and Resume Linker.
  - Multi-round Interview CRUD with stages, statuses, participants, and timezone handling.
  - Interview questions, difficulty, answer notes, reflections, and validated HTTPS LeetCode URLs.
  - Reusable contacts (`/contacts`) and application-linked contacts (`ApplicationContact`).
  - Daily focus dashboard (`/todo`) prioritizing due and overdue follow-up actions.
  - Semantic Tailwind design system with light/dark/system theme support.
- **Exit Criteria**:
  - 100% of user-owned routes enforce authenticated `user_id` scoping in automated tests.
  - Zero cross-user data leakage.
  - All database schema changes managed strictly via additive Alembic migrations.
  - Complete manual CRUD workflows operable with zero external AI dependencies.
- **Risks**: Timezone parsing discrepancies across local browsers and server UTC.
- **Explicit Deferrals**: Multi-channel external notifications (push, SMS); automatic ATS application submission.

---

### Phase 1: Controlled AI
- **Purpose**: Introduce targeted, high-utility AI capabilities anchored strictly to private application context, governed by server-side routing, schema validation, and user verification.
- **Dependencies**: Phase 0 stabilized database and interview models.
- **Key Deliverables**:
  - Server-side model routing infrastructure with secure server-side credential management (ignored local env in development; platform-managed secrets in production).
  - First production AI feature: **Interview Preparation Brief** grounded in application, job description, resume version, and interview stage.
  - Post-interview debrief assistance grounded in user-recorded interview questions and reflections.
  - Structured output validation using Pydantic schemas.
  - AI artifact lifecycle: Draft → User Review → Edit/Add Notes → Save → Explicitly Apply.
  - Explicit-confirmation write model: AI is strictly advisory and cannot execute writes or state changes without user confirmation.
  - Auditable execution metadata (provider, model, prompt_version, input_hash, cost, latency, status).
- **Exit Criteria**:
  - Production adapter for first structured-output provider (OpenAI) verified with one controlled smoke test and a limited real-use evaluation period.
  - 100% of AI outputs schema-validated before rendering to client.
  - Emergency kill switches active per AI feature.
  - Any second provider is conditional on evidence from quality, schema adherence, latency, failure rate, cost, and operational risk. Groq and xAI/Grok treated as separate providers with zero configuration conflation.
- **Risks**: Upstream provider latency and transient schema validation failures.
- **Explicit Deferrals**: Premature asynchronous task queues (Celery/RabbitMQ); autonomous agent workflows; client-side API key handling.

#### Phase 1 real-provider validation gate

Before expanding beyond the initial Interview Preparation Brief, the platform must satisfy this gate:
1. **Controlled Server-Side Smoke Test**: Successful execution of at least one controlled server-side structured-output smoke test against the live provider.
2. **Documented Quality Rubric**: Evaluation against a documented limited quality rubric using real or representative synthetic test cases.
3. **Empirical Metric Measurements**: Recorded measurement of:
   - Schema-valid output rate;
   - Timeout and safe-failure rate;
   - p50 and p95 latency;
   - Token and cost per successful artifact;
   - Unsupported-claim and hallucination rate;
   - User-rated usefulness and actionability;
   - Source-traceability quality.
4. **Security & Integrity Invariants**: Zero open critical defects regarding user privacy, tenant authorization boundaries, credential handling, or unsafe-write mechanisms.
5. **Explicit Product-Owner Decision**: An explicit Product Owner decision is required before introducing or enabling:
   - Any second AI provider (a second provider is **not automatic** and must be strictly justified by empirical evidence);
   - Artifact persistence expansion;
   - Post-interview debrief assistance;
   - AI Career Search;
   - RAG or vector retrieval pipelines;
   - Agent workflows or autonomous actions.

---

### Phase 2: Daily Career Rhythm
- **Purpose**: Transform CareerNeed into a daily habit engine by aggregating urgent actions, instilling repeatable career routines, and providing fast career navigation.
- **Dependencies**: Phase 0 core records and Phase 1 debrief capture.
- **Key Deliverables**:
  - **Action Center**: High-density aggregation of overdue follow-ups, interviews today, and prep actions.
  - **Career Routines**: Structured support for repeatable career habits (daily LeetCode/system design, weekly application reviews, weekly follow-up triage, monthly resume reviews, quarterly career-direction audits).
  - Activity timeline recording immutable career events (`application_created`, `interview_completed`, `follow_up_resolved`).
  - Resume freshness tracking alerting candidates when resume versions become stale.
  - **Direct Search**: Fast, client/SQL-based command palette for instant navigation across owned applications, interviews, contacts, and notes without LLM overhead.
  - In-app reminder banners and controlled, opt-in email digests.
- **Exit Criteria**:
  - Daily routine check-ins integrated into Today dashboard without UI clutter.
  - Direct Search responds in <100ms for typical owned data volumes.
  - Email digest delivery is idempotent and respects quiet hours.
- **Risks**: Notification fatigue leading to user disengagement.
- **Explicit Deferrals**: External messaging integrations (Telegram, WhatsApp, SMS); multi-calendar two-way synchronization.

---

### Phase 3: Career Memory and AI Search
- **Purpose**: Allow job seekers to import historical career data from external spreadsheets/notes, establish complete source provenance, and unlock grounded natural-language career search.
- **Dependencies**: Phase 0 data models, Phase 1 AI schema validation, and Phase 2 timeline foundation.
- **Key Deliverables**:
  - **Career Memory Import Pipeline**:
    - Initial file support: CSV, Markdown, TXT.
    - Safe parsing: server-side validation, sandbox execution (no macros/scripts), size/time bounds.
    - Interactive import wizard: Upload → Preview → Column/Section Mapping → AI Extraction Suggestions → User Review → Merge/Duplicate Review → Confirmation.
    - Provenance tracking: every imported record retains source file, section, and extraction evidence.
    - Reversible imports: one-click undo/rollback of imported batches.
  - **AI Career Search**:
    - "Search your career. Ask what to do next."
    - Three operational modes: Direct Search (SQL), Ask/Analyze (grounded synthesis with clickable source citations), and Plan/Act (AI-proposed action requiring user confirmation before write).
    - Layered retrieval architecture: NL Query → Intent Classification → Authorization Filter → Structured SQL / Full-Text Search → Grounded LLM Response with citations.
- **Exit Criteria**:
  - 100% of imported data verified by user before committing to canonical tables.
  - Undo import cleanly removes imported records without corrupting pre-existing history.
  - AI Career Search strictly cites verified source objects with clickable links.
  - Zero cross-user data exposure in search retrieval.
- **Risks**: Messy user CSV/Markdown schemas causing parsing ambiguities; prompt injection in untrusted imported files.
- **Explicit Deferrals**: Vector database / complex RAG infrastructure prior to import stabilization; PDF/DOCX/Notion/Google Sheets imports in initial rollout.

---

### Phase 4: Proactive Opportunity Discovery
- **Purpose**: Enable multi-track career management, resume-aware job matching, and automated job watch alerts.
- **Dependencies**: Phase 0 Job Catalog, Phase 2 Career Routines, and Phase 3 Career Memory.
- **Key Deliverables**:
  - **Candidate Profile & Career Directions**:
    - Durable Candidate Profile (skills, experience, projects, education, work authorization).
    - 1:N Career Directions (target roles, seniority, location preferences, work arrangements, exclusions).
    - Configurable active directions (default limit: 5), one active default direction.
  - **Resume Versions**: Immutable resume versions bound to specific directions or applications.
  - **Resume-Aware Matching Engine**:
    - Contextual Match Result: Job × Career Direction × Resume Version × Constraints × Config.
    - Hard eligibility evaluation (work authorization, sponsorship, location) runs before soft scoring.
    - Transparent score breakdown, matched skills, missing skills, and explainable reasons.
  - **Opportunity Watch & Alert Inbox**:
    - Automated ATS sync against watch rules.
    - Tiered alert policy: Score 85+ (Immediate In-App Alert), 70–84 (Daily Digest), 55–69 (In-App Recommendation), <55 (Hidden).
    - Feedback loop: user dismissals ("Wrong role", "No sponsorship") calibrate watch preferences.
- **Exit Criteria**:
  - Changing a resume or direction creates a versioned match result without altering historical applications.
  - Hard constraint failures return structured `not_eligible` reasons and never appear as `0%`.
  - Alert inbox surfaces high-signal opportunities with transparent explanation.
- **Risks**: Overwhelming users with low-signal match notifications; stale ATS listings.
- **Explicit Deferrals**: Telegram/push alerts before in-app alert quality is proven; non-technical role taxonomies.

---

### Phase 5: Career Intelligence Community
- **Purpose**: Build a task-driven, structured career intelligence collective where job seekers share verified interview experiences, prep packs, and compensation data without vanity social noise.
- **Dependencies**: Phase 0–4 private data models, proven interview tracking, and Phase 5 moderation architecture.
- **Key Deliverables**:
  - **Community Destinations**:
    - Interview Lab: Structured, searchable technical and behavioral interview questions by company/role.
    - Company Intelligence: Verified interview formats, rounds, timeline benchmarks, and hiring trends.
    - Offer & Compensation Desk: Anonymized technical offer breakdowns.
    - Company/Role Interview Packs: Curated preparation collections.
    - Contribution Workspace: Explicit private-to-public anonymized contribution flow.
  - **Insight-to-Action**: One-click actions to save community questions to personal practice, create prep tasks, or add to application notes.
  - **Community Trust & Pre-Moderation**:
    - Staged pre-moderation for all rewarded public contributions.
    - Anomaly detection, rate limits, and reward hold periods to prevent spam.
- **Exit Criteria**:
  - Zero accidental exposure of private user identity in community contributions.
  - All public insights directly connect to private actionable workflows.
  - Moderation queue operates with defined review SLAs.
- **Risks**: Low-quality AI spam; copied interview questions; employer retaliation concerns.
- **Explicit Deferrals**: Twitter-style open feeds; unmoderated comment sections; direct messaging between users.

---

### Phase 6: Incentives and Ecosystem Expansion
- **Purpose**: Introduce closed-loop gamification and community incentives (PetCoin, Career Pets, Badges) while exploring long-term institutional partnerships.
- **Dependencies**: Phase 5 functioning community and anti-abuse ledgers.
- **Key Deliverables**:
  - **PetCoin In-App Recognition Credit**:
    - Closed-loop, non-monetary credit earned through approved contributions and quality corrections.
    - Redeemable for premium interview packs, contributor recognition, and cosmetic pet items.
    - Strictly non-cash, non-withdrawable, and non-transferable peer-to-peer.
  - **Career Pets & Non-Pay-to-Win Badges**:
    - One primary Career Pet reflecting active career routine consistency.
    - Collectible badges celebrating verified contribution milestones, trust level, and interview milestones.
    - Badges cannot be purchased and have zero influence over job matching or hiring outcomes.
  - **B2B / Institutional Explorations**:
    - Preliminary pilot exploration with university career centers, technical bootcamps, and workforce organizations.
- **Exit Criteria**:
  - Auditable double-entry ledger for all PetCoin transactions with automated anomaly detection.
  - Zero pay-to-win influence on job discovery or match scores.
  - B2B pilots operate with strict tenant isolation and student consent guarantees.
- **Risks**: Multi-account farming of community points; regulatory risk if token language is miscommunicated.
- **Explicit Deferrals**: Crypto/blockchain integrations; public leaderboards; cash-out capabilities; company employee verification badges.

---

## 4. The "Not Now" List (Explicit Near-Term Deferrals)

To protect engineering focus and product integrity, the following items are strictly prohibited from entering active development until Phase 5 exits:
1. **Generic Social Feeds**: No public activity walls, open posts, or engagement vanity metrics.
2. **Open Direct Messaging (DMs)**: No unmoderated peer-to-peer chat systems.
3. **Automated Application Bots**: No headless browser scraping to auto-submit applications on behalf of users.
4. **Cash, Crypto, or P2P PetCoin Transfers**: PetCoin is internal product credit only.
5. **Company Employee Badges / Verification**: Requires enterprise authentication, legal trademark reviews, and fraud controls not present in early phases.
6. **Broad Non-Technical Roles**: Sales, Marketing, HR, Finance, and Operations remain deferred.
7. **Vector DB / RAG Search Before Career Memory**: Advanced vector indexing must not precede structured imports and authorization filters.
8. **Multi-Channel Push/SMS Before In-App Alert Quality**: In-app alerts must achieve proven high signal-to-noise first.
