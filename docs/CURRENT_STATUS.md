# CareerNeed Current Status

> Last verified: 2026-09-17  
> Repository: `careerneed`

## 1. Product status

CareerNeed has moved beyond the prototype stage of simply collecting jobs. The current foundation supports a fully usable, authenticated, privacy-aware job-search workspace with **User Identity, Resumes, Jobs, and Applications** as the core entities.

The foundational workflow currently in production:

**User Onboarding / Auth → Manage Resumes (with AI Skill Extraction) → Discover & Filter Jobs → Evaluate & Match → Track Applications (List & Pipeline Board) → Manage Application Details (Notes, Follow-up, Contacts, Resume Link) → Daily Follow-ups Dashboard (To Do)**

The next major milestone:

**Application → Interview Management (Upcoming Calendar & Fast Capture) → AI Interview Preparation → Post-Interview Outcome Analysis → Continuous Improvement**

---

## 2. Completed functionality

### Authentication and user isolation
- **Registration, login, logout, and session lifecycle**: Email + password registration with bcrypt-compatible hashing.
- **Session management**: Database-backed `UserSession` tokens with expiration, transmitted via secure HTTP-only cookies.
- **Password recovery**: Secure token-based password reset (`/forgot-password`, `/reset-password`) using SHA-256 hashed one-time tokens (`PasswordResetToken`).
- **Data isolation**: Every resource (`resumes`, `applications`, `application_contacts`, `companies`, `llm_credentials`, `usage_logs`) is strictly scoped by `user_id`. Cross-user access is blocked with 404/403 errors.
- **Frontend AuthGate**: Client-side session verification, route protection, and auth redirect handling.
- **Automated test suite**: Comprehensive backend authentication and cross-user isolation tests in `tests/test_auth.py`, `tests/test_applications_auth.py`, `tests/test_resumes_auth.py`, and `tests/test_settings_auth.py`.

### LLM Credentials & AI Extraction Settings
- **BYOK (Bring Your Own Key)**: Users can store their own encrypted API keys for OpenAI, Groq, or OpenRouter in `llm_credentials`.
- **Encryption at rest**: Secrets encrypted using Fernet (AES-128-CBC) via `app/crypto.py`. Keys are masked in API responses (`sk-...xxxx`).
- **Platform free tier**: Managed platform API key with a 5-call free tier tracked in `usage_logs`.
- **Extraction mode hierarchy**: Automatically selects `byok` if configured, `platform` if free calls remain, or `basic` (regex heuristic) as fallback.

### Resume management
- **PDF upload & text extraction**: PDF parsing powered by `pdfplumber` with a 10MB upload limit.
- **Automated skill extraction**: Structured extraction of technical skills via `app/services/skill_extractor.py` (LLM-based with structured schema, falling back to regex section parsing).
- **Resume labeling & versioning**: User-defined labels for targeting different roles.
- **Default resume selection**: Single active default resume constraint enforced across user's resume collection.
- **Archive & restore**: Soft archival workflow (`archived_at`), preventing archived resumes from being default or accidentally linked.
- **Application linking**: Specific resume versions can be associated with individual job applications.

### Job data and synchronization
- **Multi-source ATS connectors**:
  - Ashby (`app/connectors/ashby.py`)
  - Greenhouse (`app/connectors/greenhouse.py`)
  - Lever (`app/connectors/lever.py`)
  - Manual user entry (`POST /jobs/manual`)
- **Idempotent ingestion**: Ingestion deduplication based on composite key `(source, external_job_id)`. Re-sync updates `last_seen_at` without duplicating records.
- **Data normalization**: Unified job model with normalized `workplace_type` (remote, hybrid, on_site), location text, posted dates, and application links.
- **Deterministic match scoring**: Shared keyword-based scoring engine (`app/connectors/scoring.py`) assessing role title priority, ML infrastructure, SRE/platform keywords, and LLM relevance (0–100 score).

### Jobs dashboard (`/jobs`)
- **Unified job pool**: Displays both ingested ATS jobs and manual user-entered jobs in one interface.
- **Advanced filtering**:
  - Full-text search across title, company, and location.
  - Multi-select provider/source filters (Ashby, Greenhouse, Lever, Manual).
  - Multi-select workplace type filters (Remote, Hybrid, On-site).
  - Match score thresholds (All, 50+, 75+, 90+).
  - Recency/date filters (All time, Since yesterday, Past week, Past month).
  - Application tracking status filter (Only show Saved, Applied, etc.).
- **Search Directions**: Saved keyword sets and direction toggles for multi-track job searches.
- **URL-persisted state**: All filters, sort orders, and pagination are preserved in the URL query string.
- **Robust sorting & pagination**: Null-safe sorting (best match, most recent, title) with server-side 20-item pagination and accurate total-count headers.

### Application tracking & workspace (`/applications`)
- **Lifecycle status workflow**: `saved` → `applied` → `interviewing` → `offer` / `rejected` / `withdrawn`.
- **Dual view modes**:
  - **List view**: Table of tracked applications with status, applied date, follow-up badge, and quick actions.
  - **Pipeline / Kanban board view (`/applications/board`)**: Visual columns by status with responsive card layouts.
- **Application Detail workspace (`/applications/[applicationId]`)**:
  - Client-side data loading architecture (`ApplicationDetailClient`).
  - **Status Editor**: Instant status change with timestamp tracking.
  - **Follow-up Editor**: Date picker for scheduling follow-ups with due/overdue status detection.
  - **Notes Editor**: Markdown-friendly application notes.
  - **Resume Linker**: Associate or switch the resume version used for the application.
  - **Application Contacts Editor**: Full CRUD for recruiters, hiring managers, interviewers, and referrals (name, type, email, LinkedIn, notes).

### Daily focus dashboard (`/todo`)
- **Dashboard summary API (`/dashboard/summary`)**: Real-time counts of saved, applied, interviewing, active applications, and due/overdue follow-ups.
- **Actionable follow-ups API (`/dashboard/follow-ups`)**: Prioritized list of applications needing attention today or overdue.

### UI design system & accessibility
- **Unified Next.js App Shell**: Shared `AppHeader` with brand identity and persistent navigation.
- **Theme support**: Seamless System / Light / Dark modes powered by `next-themes` with zero hydration flash.
- **Semantic token system**: Fully migrated to Tailwind semantic tokens (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `bg-primary`) without arbitrary hard-coded palette leaks.
- **Responsive design**: Mobile-friendly layout gutters, collapsible navigation, and card layouts.

---

## 3. Current architectural milestone

The project has completed:
- **Phase 1: Foundation (Auth + Resumes + Jobs + Applications + Contacts)**.
- **Phase 2: Interview Management & Fast Capture (Interviews Data Model + CRUD API + Application Detail Interviews Section + Upcoming Interviews Dashboard + Fast Capture AI Extraction Pipeline)**.

The entire workflow from receiving recruiter email invites to AI structured extraction, user confirmation, interview scheduling, prep note management, and outcome debrief is functional, isolated by user, and tested end-to-end.

---

## 4. Known data-quality & maintenance areas

- **Job posted dates**: Continue normalizing `posted_at` vs `first_seen_at` vs `last_seen_at` across varying ATS payloads.
- **Search Direction persistence**: Sync search directions to user preferences in DB rather than browser local storage.
- **ATS sync observability**: Add an admin/user UI to view sync logs, board health, and last refresh timestamps in `/sources`.
- **Database migration hygiene**: Maintain strict Alembic migration reviews to avoid unintentional drift.

---

## 5. Transition to Phase 3: Next Priorities

With Phase 2 interview tracking and Fast Capture live, active development shifts to:
1. **AI Interview Preparation (Phase 3)**:
   - Per-interview prep generator (JD + Target Role + Resume + Round Type → targeted questions, system design checklist, behavioral STAR outlines).
2. **Post-Interview Outcome Analysis & Learning**:
   - Structured interview questions & LeetCode link association.
   - Self-reflection debrief → AI failure/success diagnosis → actionable gaps to practice.
3. **Onboarding & Profiling (Phase 4)**:
   - First-time resume deep AI profile → Target company discovery → Gap analysis to target roles.
