# CareerNeed Architecture — v0.2

> Status: Active  
> Last updated: 2026-09-17  
> Scope: Current architecture and the technical design for upcoming milestones.

---

## 1. System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 15 Web Application                   │
│  Home / To Do / Resumes / Jobs / Applications (List & Board)    │
│  Application Detail / Interviews Timeline / Fast Capture Modal  │
│  Theme Toggle (System/Light/Dark) / Auth Gate & Session Context │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS / REST / Cookies
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          FastAPI API                            │
│  ├── /auth: Session Cookies, Register, Login, Password Reset    │
│  ├── /resumes: PDF Plumber, Versioning, Skill Extraction        │
│  ├── /jobs: Search, Filters, Directions, Normalization          │
│  ├── /applications: Lifecycle, Board, Contacts, Follow-ups      │
│  ├── /interviews: Rounds, Upcoming Schedule, Fast Capture (P2)  │
│  ├── /dashboard: Summary & Urgent Follow-up Feeds               │
│  └── /settings: Encrypted LLM Credentials (BYOK) & Quotas       │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ SQLAlchemy                    │ HTTP Client
                ▼                               ▼
┌───────────────────────────────┐   ┌─────────────────────────────┐
│          PostgreSQL           │   │    LLM Intelligence Engine  │
│  - users & user_sessions      │   │  - BYOK (AES Encrypted)     │
│  - password_reset_tokens      │   │  - OpenAI / Groq / Router   │
│  - resumes & skills           │   │  - Skill Extractor          │
│  - companies & jobs           │   │  - Fast Capture Parser (P2) │
│  - applications & contacts    │   │  - AI Interview Prep (P2)   │
│  - interviews (P2)            │   │  - Failure Analyzer (P3)    │
│  - llm_credentials & logs    │   └─────────────────────────────┘
│  - career_snapshots (P4)      │
└───────────────▲───────────────┘
                │ Normalized upsert
┌───────────────┴───────────────┐
│    Python Ingestion Engine    │
│  - AshbyConnector             │
│  - GreenhouseConnector        │
│  - LeverConnector             │
│  - Manual Job Pipeline        │
└───────────────────────────────┘
```

---

## 2. Core Architectural Principles

### 2.1 Separation of Concerns & User Agency
- **Zero Silent Automation**: The system assists with data ingestion, matching, and preparation, but consequential actions (applying to a job, saving an interview, altering application status) always require explicit user review and confirmation.
- **Privacy-First Intelligence**: Candidate resumes, interview transcripts, and notes are sensitive user data. External LLM calls only occur via user-authorized credentials (BYOK) or explicit platform tier allocations, strictly isolated per user.

### 2.2 Client-Side Data Loading Architecture
- The Next.js frontend uses lightweight server route wrappers that delegate to client components (e.g., `ApplicationDetailClient`, `JobsClient`, `ApplicationsBoardClient`).
- Data access is unified through a shared `apiFetch` client that transparently handles credentials, cookies, and HTTP errors.

### 2.3 Strict Relational Isolation
- Every core entity references `user_id` with `ondelete="CASCADE"`.
- All database queries filter by `user_id == current_user.id`. Cross-user data leakage is guarded at the query layer and verified by automated regression tests.

---

## 3. Data Model & Entity Relationships

### 3.1 Existing Entities
- **User**: Authentication root, email, bcrypt-compatible password hash, reset tokens, sessions.
- **UserSession**: Database-persisted session tokens with expiration and index on `token_hash`.
- **Company**: User-owned target company or board configuration (`source_type`, `board_token`, `careers_url`).
- **Job**: Unified job pool (`source`, `external_job_id`, `title`, `company_name`, `workplace_type`, `location`, `match_score`, `application_url`).
- **Resume**: User's uploaded PDF resumes, extracted text, skills string, default flag, and soft archive timestamp.
- **Application**: The core tracking record linking a `user_id` and `job_id`, with status (`saved`, `applied`, `interviewing`, `offer`, `rejected`, `withdrawn`), `resume_id`, `applied_at`, `notes`, and `follow_up_on`.
- **ApplicationContact**: Contacts tied to an application (`contact_type`, `name`, `email`, `linkedin_url`, `notes`).
- **LLMCredential**: User-provided API keys encrypted at rest with Fernet (AES-128-CBC).
- **UsageLog**: Audit logs tracking token usage and free-tier platform quotas.

### 3.2 Phase 2 Additions: Interview Management
- **Interview Entity (`interviews`)**:
  - `id`: UUID (Primary Key)
  - `application_id`: UUID (Foreign Key to `applications.id`, ON DELETE CASCADE)
  - `round`: Integer (sequential round number)
  - `title`: String (e.g., "Technical Screen with Staff Engineer")
  - `interview_type`: String/Enum (`recruiter`, `technical_screen`, `coding`, `system_design`, `behavioral`, `hiring_manager`, `panel`, `final`, `other`)
  - `status`: String/Enum (`scheduled`, `completed`, `cancelled`, `rescheduled`)
  - `result`: String/Enum (`pending`, `passed`, `failed`, `no_decision`)
  - `scheduled_at`: DateTime with timezone (indexed for upcoming schedule queries)
  - `duration_minutes`: Integer (default 60)
  - `interviewer_name`: String (optional)
  - `interviewer_title`: String (optional)
  - `interviewer_linkedin_url`: String (optional)
  - `meeting_url`: String (Zoom, Google Meet, Teams)
  - `location`: String (e.g., "Virtual" or office address)
  - `preparation_notes`: Text (user's checklist & notes)
  - `ai_prep_plan`: JSONB (AI-generated study topics, expected questions, STAR stories)
  - `questions_asked`: Text (log of questions asked in the interview)
  - `user_reflections`: Text (self-evaluation of strengths/weaknesses)
  - `interviewer_feedback`: Text (feedback provided by recruiter/interviewer)
  - `ai_outcome_analysis`: JSONB (AI failure diagnostic and remediation advice)
  - `created_at` / `updated_at`: Timestamps

### 3.3 Phase 4 Additions: Snapshots & Profiles
- **UserCareerProfile (`user_career_profiles`)**: Stores the extracted baseline career profile, target roles, and strengths from onboarding resume analysis.
- **CareerSnapshot (`career_snapshots`)**: Immutable historical state records for longitudinal analysis.

---

## 4. Subsystems & Data Pipelines

### 4.1 Ingestion & Normalization Engine
1. **Connectors**: Modular connectors (`AshbyConnector`, `GreenhouseConnector`, `LeverConnector`) fetch public job boards.
2. **Normalization**: Enforces uniform workplace types (`remote`, `hybrid`, `on_site`), clean location strings, and valid URLs.
3. **Idempotency**: Upserts jobs by `(source, external_job_id)`. If the job exists, updates `last_seen_at` without overwriting user-tracked states.

### 4.2 Fast Capture (Smart Text Ingestion) Pipeline
1. **Raw Input**: User pastes text snippet (recruiter email or calendar invite).
2. **Context Enrichment**: The service fetches the user's active applications to match company or role names.
3. **Extraction Service**:
   - Uses structured LLM output (Pydantic schema) or robust regex heuristics.
   - Extracts: `scheduled_at`, `duration_minutes`, `interview_type`, `interviewer_name`, `meeting_url`, `matched_application_id`.
4. **Draft Preview**: Returns an uncommitted candidate payload to the frontend.
5. **Confirmation**: User reviews, edits, and commits via `POST /applications/{id}/interviews`.

### 4.3 AI Interview Preparation Pipeline
1. **Context Aggregation**: Collects Job Description + Submitted Resume + Round Type + Past Notes.
2. **Prompt Strategy**: Structured system prompt instructing the model to act as a senior technical interviewer in that domain.
3. **Structured Response**:
   - `core_technical_topics`: Concepts and system trade-offs.
   - `recommended_star_stories`: Resume experiences mapped to expected questions.
   - `risk_areas`: Known candidate gaps to review.
   - `reverse_interview_questions`: Strategic questions to ask the interviewer.

### 4.4 Post-Interview Failure Analysis Pipeline
1. **Debrief Ingestion**: User inputs questions asked, reflections, and outcome (`failed`).
2. **Multi-Source Synthesis**: Analyzes debrief against JD requirements and past interview records.
3. **Diagnostic Output**:
   - Pinpoints root failure modes (e.g., algorithmic complexity, system scale trade-offs, lack of leadership metrics).
   - Identifies recurring cross-company patterns.
   - Generates actionable remediation steps.

---

## 5. Security & Privacy Architecture

- **Encryption at Rest**: Fernet symmetric encryption for all BYOK secrets stored in `llm_credentials`.
- **Session Security**: Session tokens are hashed with SHA-256 before database lookup. Plaintext tokens exist only in secure HTTP-only cookies.
- **CSRF & Isolation**: SameSite cookie policies prevent cross-site tampering.
- **AI Boundary**: No user resumes or notes are transmitted to AI providers unless initiated by an explicit user-triggered action.

---

## 6. Architecture Decision Records (ADR)

- **ADR-001**: Use public ATS sources first (Greenhouse, Lever, Ashby) for reliable job discovery.
- **ADR-002**: Normalize payloads before database persistence to decouple the UI from vendor-specific schemas.
- **ADR-003**: Idempotent upsert on `(source, external_job_id)`.
- **ADR-004**: Manual jobs enter the unified pool with `source="manual"`.
- **ADR-005**: No automated application submissions — user retains full control.
- **ADR-006**: Session-cookie authentication with per-user database row-level isolation.
- **ADR-007**: Client-side data loading architecture for Application Detail and Jobs pages.
- **ADR-008**: Dedicated `interviews` entity cascade-linked to `applications` to cleanly separate application lifecycle from round-by-round interview tracking.
- **ADR-009**: Fast Capture uses a "Parse → Preview → Confirm" loop to prevent silent mis-parsing errors.
