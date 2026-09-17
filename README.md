# CareerNeed

<p align="center">
  <b>English</b> | <a href="README.zh-CN.md">简体中文</a>
</p>

CareerNeed is an AI-assisted career operating system and privacy-aware job-search workspace for technical professionals. It is designed to **eliminate repetitive job-search administration**, connect the full job-seeking lifecycle, and help candidates spend more time preparing and improving.

```text
Upload Resume & AI Analysis
  ↳ Discover Target Companies & Auto-Sync Jobs
    ↳ Evaluate Fit & Career Gap Analysis
      ↳ Track Applications (List & Pipeline Board)
        ↳ Manage Interview Schedule & Fast Capture
          ↳ AI Interview Prep & Actionable Practice
            ↳ Post-Interview Failure/Outcome Analysis
              ↳ Continuous Career Growth
```

---

## Product Philosophy

> **"Reduce recording time, maximize improvement focus, and provide actionable growth guidance."**

CareerNeed operates on three core principles:
1. **Zero Busywork**: Prefer *Paste → Auto-Extract → Preview → Confirm* over filling out 15 form fields manually.
2. **Actionable Intelligence over Passive Records**: Never treat records as dead data. Every job, application, and interview should answer: *What should I prepare? What am I missing? Why did I fail? What do I do next?*
3. **User Agency & Data Privacy**: All career data and LLM keys (BYOK) are private and isolated to the authenticated user. AI recommendations are assistive and explainable, never silent or autonomous.

---

## Current Scope & Completed Features

- **Authentication & User Isolation**: Full registration, login, logout, password reset via secure tokens, session cookies, and strict per-user database isolation.
- **Resume Management**: Multi-version PDF upload (`pdfplumber`), automated technical skill extraction (LLM-powered with regex fallback), label categorization, default resume toggle, and soft archive/restore.
- **Job Ingestion & Sourcing**: Production connectors for Ashby, Greenhouse, and Lever public ATS boards, plus manual job entry (`POST /jobs/manual`) with idempotent deduplication.
- **Unified Jobs Dashboard (`/jobs`)**: Search by title/company/location, saved Search Directions, multi-select source & workplace filters, deterministic match scoring thresholds (0–100), recency filters, and URL-persisted filter state.
- **Applications Tracking (`/applications`)**:
  - Full lifecycle tracking: `saved` → `applied` → `interviewing` → `offer` / `rejected` / `withdrawn`.
  - Dual views: Filterable Table List view and visual Kanban Pipeline Board (`/applications/board`).
  - Application Detail workspace (`/applications/[applicationId]`): Status updates, follow-up scheduler, rich markdown notes, resume linking, and full contact management (recruiters, hiring managers, interviewers, referrals).
- **Daily Focus Dashboard (`/todo`)**: Tracks active pipeline metrics, follow-ups due today, and overdue actions.
- **LLM Settings & Security (`/settings`)**: BYOK (Bring Your Own Key) encrypted storage for OpenAI, Groq, and OpenRouter, platform free tier quota tracking, and audit logging.
- **UI Design System**: Built on Next.js 15, Tailwind CSS with semantic tokens, and zero-flicker System / Light / Dark theme support.

---

## Documentation & Specifications

All project documentation is consolidated in the [`docs/`](docs/DOC_README.md) directory:

- [Documentation Index (`docs/DOC_README.md`)](docs/DOC_README.md) — Directory map, reading paths, and documentation maintenance rules.
- [Current Status (`docs/CURRENT_STATUS.md`)](docs/CURRENT_STATUS.md) — Detailed checklist of verified completed functionality.
- [Product Specification (`docs/PRODUCT_SPEC.md`)](docs/PRODUCT_SPEC.md) — Comprehensive functional specifications (v0.2), including Interview Management and AI coaching modules.
- [Product Roadmap (`docs/ROADMAP.md`)](docs/ROADMAP.md) — Phased development plan from current foundation to autonomous career intelligence.
- [Product Requirements (`docs/PRODUCT_REQUIREMENT.md`)](docs/PRODUCT_REQUIREMENT.md) — Detailed requirements, user stories, and acceptance criteria (PRD v0.2).
- [System Architecture (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md) — Technical architecture, data models, connector boundaries, and AI pipelines.
- [Project Conventions (`docs/PROJECT_CONVINTIONS.md`)](docs/PROJECT_CONVINTIONS.md) — Engineering guidelines, UI design tokens, API patterns, and Definition of Done.

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Git

---

## Getting Started

### 1. Start the Database

```bash
cp .env.example .env
docker compose up -d db
docker compose ps
```

### 2. Start the FastAPI Backend

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: `GET http://localhost:8000/health` → `{"status": "ok", "service": "careerneed-api"}`

### 3. Start the Next.js Frontend

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

### Backend Tests
```bash
cd apps/api
source .venv/bin/activate
python -m pytest -q
```

### Frontend Lint & Build
```bash
cd apps/web
npm run lint
npm run build
```

---

## Core API Overview

- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- **Resumes**: `GET /resumes`, `POST /resumes/upload`, `GET /resumes/{id}`, `PATCH /resumes/{id}`, `DELETE /resumes/{id}`
- **Jobs**: `GET /jobs`, `GET /jobs/{id}`, `PATCH /jobs/{id}/status`, `POST /jobs/manual`
- **Applications**: `GET /applications`, `POST /applications`, `GET /applications/{id}`, `PATCH /applications/{id}`, `DELETE /applications/{id}`, `PUT /applications/by-job/{job_id}`, `GET /applications/me/job-states`
- **Application Contacts**: `GET /applications/{id}/contacts`, `POST /applications/{id}/contacts`, `PATCH /applications/{id}/contacts/{contact_id}`, `DELETE /applications/{id}/contacts/{contact_id}`
- **Connectors**: `POST /connectors/{greenhouse|lever|ashby}/sync`, `POST /connectors/{greenhouse|lever|ashby}/sync-all`
- **Dashboard**: `GET /dashboard/summary`, `GET /dashboard/follow-ups`
- **Settings**: `GET /settings/llm-credentials`, `POST /settings/llm-credentials`, `DELETE /settings/llm-credentials/{provider}`, `GET /settings/extraction-mode`
- **Interviews (Upcoming Phase 2)**: `GET /interviews/upcoming`, `GET /applications/{id}/interviews`, `POST /applications/{id}/interviews`, `POST /interviews/fast-capture`, `POST /interviews/{id}/prep-plan`, `POST /interviews/{id}/analyze-outcome`

---

## What's Next

The team is currently building **Phase 2: Interview Management & AI Preparation**:
1. **Interview Entity & Multi-Round Tracking**: Scheduled dates, round types (Recruiter, Coding, System Design, Behavioral), and interviewer notes.
2. **Upcoming Interview Timeline**: Clear view of interviews scheduled in the next 1–7 days.
3. **Fast Capture**: Paste recruiter emails or calendar invites to automatically populate interview records.
4. **AI Interview Prep & Post-Mortem Diagnosis**: Personalized preparation guides and failure analysis to turn every interview into a learning opportunity.
