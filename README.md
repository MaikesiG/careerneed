# Careerneed

Careerneed is a privacy-aware career intelligence platform for technical professionals. It ingests jobs from public company sources, matches them against resume and project evidence, and turns job-market signals into explainable, actionable career-growth plans.

## Current scope

- Next.js workspace with Home, To Do, Jobs, Applications, Resumes, and Sources
- Application tracking with status, notes, follow-up dates, and application contacts
- FastAPI API with job, company, resume, application, and contact CRUD
- Keyword-based deterministic match scoring and paginated job/application lists
- Greenhouse, Lever, and Ashby public ATS connectors with batch sync across configured companies
- PostgreSQL via Docker Compose, with schema changes managed by reviewed Alembic migrations
- Manual API and browser verification for current application/contact workflows

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- Git

## Start the database

```bash
cp .env.example .env
docker compose up -d db
docker compose ps
```

## Start the API

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate  # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs to explore the API. `GET /health` should return `{"status": "ok", "service": "careerneed-api"}`.

## Start the web app

```bash
cd apps/web
npm run dev
```

Open http://localhost:3000.

## Run tests

```bash
cd apps/api
source .venv/bin/activate
python -m pytest -q
```

## API overview

### Jobs

- `GET /jobs` — list jobs, filterable by `status` and `location`, paginated via `limit`/`offset` (default `limit=500`, max `1000`). Total count is returned in the `X-Total-Count` response header.
- `GET /jobs/{job_id}` — fetch a single job with full description.
- `PATCH /jobs/{job_id}/status` — update status (`new`, `saved`, `applied`, `dismissed`).
- `POST /jobs/manual` — add a job manually, outside of any connector.

### Companies

- `GET /companies` — list configured companies.
- `POST /companies` — register a new company (`source_type`: `greenhouse`, `lever`, `custom`, or `manual`).

### Applications and contacts

- `GET /applications` — list the current user's tracked applications; supports status, follow-up, limit, and offset filters.
- `GET /applications/{application_id}` — fetch one tracked application and its job summary.
- `POST /applications` — create a tracked application for a job.
- `PATCH /applications/{application_id}` — update application status, resume, applied date, notes, or follow-up date.
- `DELETE /applications/{application_id}` — remove an application.
- `GET /applications/{application_id}/contacts` — list contacts associated with an application.
- `POST /applications/{application_id}/contacts` — add a recruiter, hiring manager, interviewer, referral, or other contact.
- `PATCH /applications/{application_id}/contacts/{contact_id}` — update an application contact.
- `DELETE /applications/{application_id}/contacts/{contact_id}` — delete an application contact.

Contacts contain a required name and contact type, plus optional email, LinkedIn URL, and notes. Contact routes verify that the parent application belongs to the current development user. Full authentication is still a future milestone.

### Connectors

- `POST /connectors/greenhouse/sync?board_token=...&company_name=...` — sync one Greenhouse-hosted company.
- `POST /connectors/greenhouse/sync-all` — sync every active company with `source_type=greenhouse`.
- `POST /connectors/lever/sync?company_slug=...&company_name=...` — sync one Lever-hosted company.
- `POST /connectors/lever/sync-all` — sync every active company with `source_type=lever`.

Sync endpoints are idempotent: jobs are deduplicated by `(source, external_job_id)`, and re-running a sync only updates `last_seen_at` on existing jobs.

## Match scoring

Every ingested job gets a `match_score` (0-100) from `app/connectors/scoring.py`, shared across all connectors so scoring is consistent regardless of source ATS. Scoring logic:

- Titles matching non-engineering patterns (sales, recruiting, legal, generic management, etc.) are capped at 15.
- High-priority keywords (ML infrastructure, MLOps, research engineer/scientist, GPU/kernel/compiler work) score 40.
- Medium-priority keywords (SRE, platform/infrastructure engineer) score 15-30 depending on AI/ML context.
- Low-priority keywords (AI agents, LLM, prompt engineering) score 20.
- Generic engineering titles score 10 as a baseline.

## Architecture notes

- `app/connectors/<ats>.py` — one module per ATS, each exposing `fetch_*_jobs`, `sync_*_jobs`, and `sync_all_*_companies`, all built against the shared `Company`/`Job` models.
- `app/connectors/scoring.py` — shared keyword lists and `calculate_match_score`, imported by every connector.
- Connector errors (unreachable board, disabled API access) raise `ValueError` and are surfaced as `422` with a descriptive message on single-company sync, or collected per-company on batch sync so one failing company doesn't block the rest.

## Next milestone

Add automated API coverage for application contacts, then address Alembic schema-drift checks and replace the development-only fixed user ID with real authentication and per-user isolation.
