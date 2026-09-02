# Careerneed

Careerneed is a privacy-aware career intelligence platform for technical professionals. It ingests jobs from public company sources, matches them against resume and project evidence, and turns job-market signals into explainable, actionable career-growth plans.

## Day 1 scope

- Next.js web shell
- FastAPI API with `GET /health`
- PostgreSQL via Docker Compose
- A shared local development workflow

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
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs and verify `GET /health` returns `{"status": "ok"}`.

## Start the web app

```bash
cd apps/web
npm run dev
```

Open http://localhost:3000.

## Day 1 definition of done

- [ ] PostgreSQL container is healthy
- [ ] FastAPI `/health` responds with HTTP 200
- [ ] Next.js dashboard shell opens locally
- [ ] Web dashboard displays the API health state
- [ ] First commit is pushed to a private GitHub repository named `careerneed`

## Next milestone

Add the `companies` and `jobs` tables, then implement `GET /jobs` backed by mock data before integrating Greenhouse.
