"""Seed script: inserts sample companies and jobs for local testing.

Run with:
    python -m app.seed
"""

from datetime import datetime

from app.database import Base, SessionLocal, engine
from app.models import Company, Job

Base.metadata.create_all(bind=engine)

SAMPLE_COMPANIES = [
    {"name": "Datadog", "source_type": "greenhouse", "board_token": "datadog", "priority": "high"},
    {
        "name": "Cloudflare",
        "source_type": "greenhouse",
        "board_token": "cloudflare",
        "priority": "high",
    },
    {"name": "Vercel", "source_type": "lever", "board_token": "vercel", "priority": "medium"},
]

SAMPLE_JOBS = [
    {
        "company_name": "Datadog",
        "source": "greenhouse",
        "source_type": "company_ats",
        "external_job_id": "seed-001",
        "title": "Platform Engineer",
        "location": "New York, NY",
        "workplace_type": "Hybrid",
        "description": (
            "Build internal developer platform tooling with Python, Docker, and Kubernetes."
        ),
        "application_url": "https://boards.greenhouse.io/datadog/jobs/seed-001",
        "status": "new",
        "match_score": 78,
    },
    {
        "company_name": "Cloudflare",
        "source": "greenhouse",
        "source_type": "company_ats",
        "external_job_id": "seed-002",
        "title": "Site Reliability Engineer",
        "location": "Remote, US",
        "workplace_type": "Remote",
        "description": ("Own CI/CD pipelines, observability, and production reliability."),
        "application_url": "https://boards.greenhouse.io/cloudflare/jobs/seed-002",
        "status": "new",
        "match_score": 74,
    },
    {
        "company_name": "Vercel",
        "source": "lever",
        "source_type": "company_ats",
        "external_job_id": "seed-003",
        "title": "Software Engineer, Developer Platform",
        "location": "New York, NY",
        "workplace_type": "Hybrid",
        "description": (
            "Work on developer tooling, GitHub Actions integrations, and deployment pipelines."
        ),
        "application_url": "https://jobs.lever.co/vercel/seed-003",
        "status": "new",
        "match_score": 81,
    },
]


def run() -> None:
    db = SessionLocal()
    try:
        for company_data in SAMPLE_COMPANIES:
            exists = db.query(Company).filter_by(name=company_data["name"]).first()
            if not exists:
                db.add(Company(**company_data))
        db.commit()

        for job_data in SAMPLE_JOBS:
            exists = (
                db.query(Job)
                .filter_by(source=job_data["source"], external_job_id=job_data["external_job_id"])
                .first()
            )
            if not exists:
                db.add(Job(**job_data, posted_at=datetime.utcnow()))
        db.commit()
        print(f"Seeded {len(SAMPLE_COMPANIES)} companies and {len(SAMPLE_JOBS)} jobs.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
