# Phase 1: Core Foundation (Completed ✅)

> Status: Completed & Verified  
> Milestone: Foundation (Auth + Resumes + Jobs + Applications + Contacts + BYOK)  
> Repository: `careerneed`

---

## 1. Objective & Scope

Establish the fundamental, reliable, and privacy-aware data foundation for CareerNeed. Phase 1 proves the core job-search workflow without relying on brittle automations:

```text
User Registration & Auth
  ↳ Multi-Version Resume Management & Skill Extraction
    ↳ Public ATS Job Sourcing (Ashby, Greenhouse, Lever, Manual)
      ↳ Unified Jobs Search, Filtering & Search Directions
        ↳ Application Tracking (List & Pipeline Kanban Board)
          ↳ Application Detail Workspace (Status, Notes, Follow-up, Contacts)
            ↳ Daily Focus Dashboard (/todo)
              ↳ Secure LLM Credentials (BYOK & Encryption)
```

---

## 2. Key Modules & Technical Implementation

### 2.1 Authentication & Multi-Tenant Data Isolation
- **Registration & Login**: Secure email and password registration using bcrypt-compatible hashing.
- **Session Lifecycle**: Database-backed `UserSession` tokens with expiration, stored in secure HTTP-only cookies.
- **Password Recovery**: Secure token-based password reset (`/forgot-password`, `/reset-password`) using SHA-256 hashed one-time tokens (`PasswordResetToken`).
- **Row-Level User Isolation**: Every core entity (`resumes`, `applications`, `application_contacts`, `companies`, `llm_credentials`, `usage_logs`) is bound to `user_id` with `ondelete="CASCADE"`. All database queries strictly enforce `where(Entity.user_id == current_user.id)`.
- **Automated Test Suite**: Full test coverage in `tests/test_auth.py`, `tests/test_applications_auth.py`, `tests/test_resumes_auth.py`, and `tests/test_settings_auth.py`.

### 2.2 Resume Management & Skill Extraction
- **Multi-Version Upload**: PDF parsing via `pdfplumber` with file size validation (10MB limit).
- **Skill Extraction Engine**:
  - LLM-powered structured extraction using OpenAI, Groq, or OpenRouter.
  - Heuristic fallback using regex section parsing when LLM credentials or quotas are unavailable.
- **Version Control**: Custom labels, default resume toggle constraint, and soft archival (`archived_at`).
- **Application Association**: Applications can link directly to a specific resume version.

### 2.3 Job Ingestion & Normalization Engine
- **ATS Connectors**:
  - `AshbyConnector` (`app/connectors/ashby.py`)
  - `GreenhouseConnector` (`app/connectors/greenhouse.py`)
  - `LeverConnector` (`app/connectors/lever.py`)
  - `ManualJobEntry` (`POST /jobs/manual`)
- **Idempotent Storage**: Deduplicates jobs by `(source, external_job_id)` composite key; re-sync updates `last_seen_at` without duplicating records.
- **Normalized Schema**: Unified `Job` model standardizing workplace type (`remote`, `hybrid`, `on_site`), locations, and application links.
- **Deterministic Match Scoring**: Keyword-based scoring engine (`app/connectors/scoring.py`) evaluating role title priority, AI/ML keywords, and infrastructure patterns.

### 2.4 Jobs Dashboard (`/jobs`)
- Full-text search across job title, company, and location.
- Multi-select filters for ATS provider and workplace type.
- Match score thresholds (All, 50+, 75+, 90+) and publication date recency filters.
- **Search Directions**: Reusable, saved keyword groupings for multi-track job searching.
- URL-persisted filter state surviving page refresh and browser navigation.

### 2.5 Applications Workspace (`/applications`)
- **Lifecycle Tracking**: `saved` → `applied` → `interviewing` → `offer` / `rejected` / `withdrawn`.
- **Dual Views**:
  - Filterable Table List View.
  - Pipeline Kanban Board (`/applications/board`).
- **Application Detail Workspace (`/applications/[applicationId]`)**:
  - Lightweight client-side architecture (`ApplicationDetailClient`).
  - Status Editor with timestamp recording.
  - Follow-up Editor with due/overdue scheduling logic.
  - Rich Markdown Notes Editor.
  - Application Contacts Editor (Recruiters, Hiring Managers, Interviewers, Referrals).

### 2.6 Daily Focus Dashboard (`/todo`)
- Real-time pipeline metrics via `GET /dashboard/summary`.
- Prioritized overdue and due-today follow-up feed via `GET /dashboard/follow-ups`.

### 2.7 LLM BYOK & Security Settings (`/settings`)
- Bring Your Own Key (BYOK) for OpenAI, Groq, and OpenRouter.
- Secrets encrypted at rest using Fernet (AES-128-CBC) via `app/crypto.py`.
- 5-call platform free tier quota tracking via `usage_logs`.

---

## 3. Git Commit History for Phase 1

- `f974d53` fix: forward session cookies for jobs requests
- `fce0b49` fix: add company ownership and repair migration bootstrap
- `736ec69` feat: scope companies to authenticated users
- `4ef2237` feat: organize environment configuration
- `f5ee52d` docs: redefine CareerNeed product roadmap and specifications
- *(Pending current commit)* `feat(auth): add password recovery and reset flow`
