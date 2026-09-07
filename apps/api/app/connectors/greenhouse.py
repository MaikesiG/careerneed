from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors.scoring import calculate_match_score
from app.models import Company, Job

GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards"


def fetch_greenhouse_jobs(board_token: str) -> list[dict]:
    url = f"{GREENHOUSE_API_BASE}/{board_token}/jobs"
    try:
        response = httpx.get(url, params={"content": "true"}, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Greenhouse API rejected board_token='{board_token}' "
            f"(status {exc.response.status_code}). This company may have "
            f"disabled public API access."
        ) from exc
    return response.json().get("jobs", [])


def get_or_create_company(db: Session, board_token: str, company_name: str) -> Company:
    company = db.scalar(select(Company).where(Company.board_token == board_token))
    if company:
        return company
    company = Company(name=company_name, source_type="greenhouse", board_token=board_token)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def sync_greenhouse_jobs(db: Session, board_token: str, company_name: str) -> dict:
    raw_jobs = fetch_greenhouse_jobs(board_token)
    company = get_or_create_company(db, board_token, company_name)

    created = 0
    skipped = 0

    for raw in raw_jobs:
        external_job_id = str(raw.get("id"))
        application_url = raw.get("absolute_url")
        if not external_job_id or not application_url:
            continue

        existing = db.scalar(
            select(Job).where(
                Job.source == "greenhouse",
                Job.external_job_id == external_job_id,
            )
        )
        if existing:
            existing.last_seen_at = datetime.utcnow()
            skipped += 1
            continue

        location = (raw.get("location") or {}).get("name", "Remote")[:500]
        title = raw.get("title", "Untitled")
        description = raw.get("content", "")

        job = Job(
            company_id=company.id,
            company_name=company.name,
            source="greenhouse",
            source_type="company_ats",
            external_job_id=external_job_id,
            title=title,
            location=location,
            workplace_type="Unknown",
            description=description,
            application_url=application_url,
            source_url=f"https://job-boards.greenhouse.io/{board_token}",
            status="new",
            match_score=calculate_match_score(title, description),
        )
        db.add(job)
        created += 1

    db.commit()
    return {"fetched": len(raw_jobs), "created": created, "skipped": skipped}


def sync_all_greenhouse_companies(db: Session) -> list[dict]:
    companies = db.scalars(
        select(Company).where(Company.source_type == "greenhouse", Company.active)
    ).all()

    results = []
    for company in companies:
        if not company.board_token:
            results.append(
                {
                    "company": company.name,
                    "error": "no board_token configured",
                }
            )
            continue
        try:
            result = sync_greenhouse_jobs(db, company.board_token, company.name)
            results.append({"company": company.name, **result})
        except ValueError as exc:
            results.append({"company": company.name, "error": str(exc)})

    return results
