from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors.scoring import calculate_match_score
from app.models import Company, Job
from app.normalization import normalize_workplace_type

LEVER_API_BASE = "https://api.lever.co/v0/postings"


def fetch_lever_jobs(company_slug: str) -> list[dict]:
    url = f"{LEVER_API_BASE}/{company_slug}"
    try:
        response = httpx.get(url, params={"mode": "json"}, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Lever API rejected company_slug='{company_slug}' "
            f"(status {exc.response.status_code}). This company may not "
            f"use Lever or has disabled public API access."
        ) from exc
    data = response.json()
    if not isinstance(data, list):
        raise ValueError(
            f"Lever API returned unexpected response for company_slug='{company_slug}'."
        )
    return data


def get_or_create_company(db: Session, company_slug: str, company_name: str) -> Company:
    company = db.scalar(select(Company).where(Company.board_token == company_slug))
    if company:
        return company
    company = Company(name=company_name, source_type="lever", board_token=company_slug)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def sync_lever_jobs(
    db: Session,
    company_slug: str,
    company_name: str,
    *,
    company: Company | None = None,
) -> dict:
    raw_jobs = fetch_lever_jobs(company_slug)
    company = company or get_or_create_company(db, company_slug, company_name)

    created = 0
    skipped = 0

    for raw in raw_jobs:
        external_job_id = raw.get("id")
        application_url = raw.get("hostedUrl") or raw.get("applyUrl")
        if not external_job_id or not application_url:
            continue

        existing = db.scalar(
            select(Job).where(
                Job.source == "lever",
                Job.external_job_id == external_job_id,
            )
        )
        if existing:
            existing.last_seen_at = datetime.utcnow()
            skipped += 1
            continue

        categories = raw.get("categories") or {}
        location = (categories.get("location") or "Remote")[:500]
        title = raw.get("text", "Untitled")
        description = raw.get("descriptionPlain") or raw.get("description") or ""
        workplace_type = normalize_workplace_type(raw.get("workplaceType"))

        posted_at = None
        created_at_ms = raw.get("createdAt")
        if created_at_ms:
            try:
                posted_at = datetime.utcfromtimestamp(created_at_ms / 1000)
            except (TypeError, ValueError):
                posted_at = None

        job = Job(
            company_id=company.id,
            company_name=company.name,
            source="lever",
            source_type="company_ats",
            external_job_id=external_job_id,
            title=title,
            location=location,
            workplace_type=workplace_type,
            description=description,
            application_url=application_url,
            source_url=f"https://jobs.lever.co/{company_slug}",
            status="new",
            match_score=calculate_match_score(title, description),
            posted_at=posted_at,
        )
        db.add(job)
        created += 1

    db.commit()
    return {"fetched": len(raw_jobs), "created": created, "skipped": skipped}


def sync_all_lever_companies(db: Session) -> list[dict]:
    companies = db.scalars(
        select(Company).where(Company.source_type == "lever", Company.active)
    ).all()

    results = []
    for company in companies:
        if not company.board_token:
            results.append({"company": company.name, "error": "no board_token configured"})
            continue
        try:
            result = sync_lever_jobs(db, company.board_token, company.name)
            results.append({"company": company.name, **result})
        except ValueError as exc:
            results.append({"company": company.name, "error": str(exc)})

    return results
