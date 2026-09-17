# CareerNeed Product Roadmap

> Status: Active & Aligned  
> Last Updated: 2026-09-17  
> Repository: `careerneed`

---

## Strategic Overview

CareerNeed transforms job search from a chaotic administrative chore into a focused, continuous growth loop. 

```text
Phase 1: Core Foundation (COMPLETED)
   ↓
Phase 2: Interview Management & Fast Capture (CURRENT SPRINT)
   ↓
Phase 3: AI Interview Preparation & Post-Mortem Failure Analysis
   ↓
Phase 4: Onboarding AI Resume Analysis & Career Profiling
   ↓
Phase 5: Company Recommendations & Automated Job Crawling
   ↓
Phase 6: Explainable JD Matching & Career Gap Roadmap
   ↓
Phase 7: Stage Snapshots, Backup & Longitudinal Career Intelligence
   ↓
Phase 8: Automation, Reminders & External Integrations
```

---

## Phase 1: Core Foundation (Completed ✅)

- **Authentication & User Isolation**: Full registration, login, logout, password reset tokens, session cookies, and strict per-user database row-level isolation.
- **Resume Management**: Multi-version PDF upload via `pdfplumber`, technical skill extraction (LLM + regex heuristic fallback), default resume selection, labeling, and soft archival.
- **Job Synchronization & Normalization**: Connectors for Ashby, Greenhouse, Lever, and Manual entry. Idempotent upsert via `(source, external_job_id)`.
- **Jobs Dashboard (`/jobs`)**: Real-time search, saved Search Directions, multi-select provider and workplace type filters, match score thresholds, and URL query state persistence.
- **Application Tracking (`/applications`)**: Full lifecycle status workflow, dual views (Table List and Pipeline Kanban Board), follow-up date picker, markdown notes, resume linker, and recruiter/interviewer contact management.
- **Daily Focus Dashboard (`/todo`)**: Prioritized follow-ups due today and overdue tracking.
- **Security & LLM Infrastructure (`/settings`)**: Encrypted BYOK key management (OpenAI, Groq, OpenRouter), 5-call platform free tier, and usage logs.
- **UI Design System**: Shared AppHeader, semantic Tailwind design tokens, and flicker-free System / Light / Dark theme support.

---

## Phase 2: Interview Management & Fast Capture (Current Milestone 🎯)

**Objective**: Turn every active application into a structured, stress-free interview journey and eliminate manual copy-pasting.

### Step 2.1: Interview Data Model & Schema Migrations
- Create `interviews` table linked to `applications.id` with `ON DELETE CASCADE`.
- Support fields: `round`, `title`, `interview_type`, `scheduled_at`, `duration_minutes`, `interviewer_name`, `interviewer_title`, `meeting_url`, `location`, `status`, `result`, `preparation_notes`.
- Review and apply Alembic migration.

### Step 2.2: Interview API Endpoints
- `GET /applications/{application_id}/interviews` — List rounds for an application.
- `POST /applications/{application_id}/interviews` — Create a new round.
- `PATCH /applications/{application_id}/interviews/{interview_id}` — Update round details.
- `DELETE /applications/{application_id}/interviews/{interview_id}` — Delete round.
- `GET /interviews/upcoming` — List all upcoming interviews for the authenticated user across all applications.

### Step 2.3: Application Detail Integration
- Add an **Interviews Section** to the Application Detail workspace (`/applications/[applicationId]`).
- Show all scheduled and past rounds chronologically.
- Inline status and result toggles (`scheduled`, `completed`, `passed`, `failed`).

### Step 2.4: Upcoming Interview Calendar & Daily Focus
- Dedicated overview widget on `/todo` and `/applications`:
  - *Interviews in the next 24h, 3 days, and 7 days.*
  - Company name, role title, round number, and interview type.
  - Direct 1-click launch to the meeting URL (Zoom/Meet/Teams).
  - Preparation readiness indicator.

### Step 2.5: Fast Capture (Smart Text Ingestion)
- **Problem**: Manually entering company, date, round, duration, and interviewer details causes friction.
- **Solution**: "Paste & Extract" modal:
  1. User pastes recruiter email or calendar invite snippet.
  2. Backend LLM/regex parser identifies date/time, round type, interviewer, duration, and meeting link.
  3. Pre-populates preview modal for instant 1-click confirmation.

---

## Phase 3: AI Interview Preparation & Post-Mortem Analysis

**Objective**: Help the user win every round, and learn deeply from every failure.

### Step 3.1: Per-Interview AI Preparation
- Inputs: Job Description + Submitted Resume + Round Type + Past Notes + Company Context.
- Output:
  - High-probability technical questions and trade-offs.
  - Recommended STAR behavioral stories from candidate's resume.
  - Identified gap warnings to review before the call.
  - High-leverage questions to ask the interviewer.

### Step 3.2: Post-Interview Debrief & Outcome Recording
- Quick post-call note logger:
  - Questions asked.
  - Where the candidate felt strong or stumbled.
  - Any interviewer feedback received.
  - Pass / Fail / Waiting result.

### Step 3.3: AI Failure Diagnostic & Improvement Engine
- When an interview fails:
  - AI identifies root causes (technical depth, system design scaling, behavioral structuring, time management).
  - Cross-interview pattern recognition: detects recurring failure modes across companies.
  - Generates concrete remediation: specific topics to study, mock interview recommendations, or project areas to build.

---

## Phase 4: First-Use Onboarding, Resume AI Analysis & Profiling

**Objective**: Make the resume the foundational profile of the entire user experience.

### Step 4.1: First-Use Onboarding Wizard
- User is prompted to upload their primary resume upon first login.
- Extracts comprehensive skills, languages, infrastructure tooling, and project experiences.
- Categorizes seniority (Junior, Mid, Senior, Staff) and domain expertise.

### Step 4.2: Interactive Profile Review
- User reviews and tunes their extracted skills, target role titles, and workplace preferences.
- Establishes the user's baseline `UserCareerProfile`.

---

## Phase 5: Target Company Recommendation & Automated Job Crawling

**Objective**: Proactively find relevant opportunities without mindless manual board browsing.

### Step 5.1: AI Target Company Recommendation
- Recommends companies hiring for the user's stack and seniority.
- Segments recommendations: High-Fit vs. Stretch/Aspirational.
- Suggests company categories (e.g., AI Infrastructure, DevTools, FinTech).

### Step 5.2: Automated Ingestion from Target Companies
- User selects companies or adds custom company career URLs.
- System automatically detects ATS provider (Ashby, Greenhouse, Lever, Workday) and schedules background job syncs.

---

## Phase 6: Explainable JD Matching & Career Gap Roadmap

**Objective**: Show candidates exactly where they stand and how to reach their dream roles.

### Step 6.1: Explainable Match & Readiness Scoring
- Beyond title keywords: semantic comparison between full JD requirements and resume evidence.
- Distinguishes **Match** (alignment with background) from **Readiness** (interview readiness and immediate prep needs).

### Step 6.2: Actionable Career Gap Roadmap
- Identifies critical missing requirements for aspirational roles.
- Generates a prioritized bridge plan:
  - Quick wins (tutorials, certifications, micro-projects).
  - Substantial projects (architecture evidence to add to GitHub/resume).
  - Interview preparation topics.

---

## Phase 7: Stage Snapshots, Backup & Longitudinal Intelligence

**Objective**: Protect career search history and extract long-term insights.

### Step 7.1: Career History Snapshots
- Automatically snapshots user state at key milestones:
  - Resumes submitted to each application.
  - Application status timeline.
  - Interview notes, preparation guides, and diagnostic analyses.

### Step 7.2: Longitudinal Analytics
- Conversion rates: Application → Interview → Offer.
- Pass rates by interview type (Coding vs. System Design vs. Behavioral).
- Offer outcome analysis and salary benchmarking.
- Full JSON/CSV data export.

---

## Phase 8: Automation, Reminders & Integrations

**Objective**: Seamless background support without removing user agency.

- Google Calendar & Outlook calendar synchronization for interview events.
- Email follow-up alerts and interview reminders.
- Browser extension for 1-click job saving from LinkedIn, Indeed, and company sites.
- Automated ATS board health checks.
