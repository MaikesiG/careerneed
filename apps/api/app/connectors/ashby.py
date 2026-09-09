from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.connectors.scoring import calculate_match_score
from app.models import Company, Job

ASHBY_API_BASE = "https://api.ashbyhq.com/posting-api/job-board"


def fetch_ashby_jobs(board_token: str) -> list[dict]:
    """Fetch publicly listed jobs from an Ashby-hosted job board."""
    url = f"{ASHBY_API_BASE}/{board_token}"

    try:
        response = httpx.get(
            url,
            params={"includeCompensation": "true"},
            timeout=15.0,
        )
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Ashby API rejected board_token='{board_token}' "
            f"(status {exc.response.status_code}). Verify that the company "
            f"uses Ashby and that its public job board name is correct."
        ) from exc
    except httpx.RequestError as exc:
        raise ValueError(
            f"Could not reach Ashby for board_token='{board_token}': {exc}"
        ) from exc

    data = response.json()
    jobs = data.get("jobs")

    if not isinstance(jobs, list):
        raise ValueError(
            f"Ashby API returned an unexpected response for board_token='{board_token}'."
        )

    # Ashby may include unlisted postings intended for direct-link access only.
    return [job for job in jobs if job.get("isListed", True)]


def get_or_create_company(db: Session, board_token: str, company_name: str) -> Company:
    """Return the Ashby company source for this board, creating it if needed."""
    company = db.scalar(
        select(Company).where(
            Company.source_type == "ashby",
            Company.board_token == board_token,
        )
    )

    if company is not None:
        return company

    company = Company(
        name=company_name,
        source_type="ashby",
        board_token=board_token,
        careers_url=f"https://jobs.ashbyhq.com/{board_token}",
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    return company


def parse_ashby_datetime(value: object) -> datetime | None:
    """Parse Ashby's ISO 8601 publishedAt value into a Python datetime."""
    if not isinstance(value, str) or not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def normalize_location(raw_job: dict) -> str:
    """Return a displayable location while preserving Ashby's remote signal."""
    location = raw_job.get("location")

    if isinstance(location, str) and location.strip():
        return location.strip()[:500]

    if raw_job.get("isRemote") is True:
        return "Remote"

    return "Location not specified"


def sync_ashby_jobs(db: Session, board_token: str, company_name: str) -> dict:
    """Fetch, normalize, and persist current public jobs for one Ashby board."""
    raw_jobs = fetch_ashby_jobs(board_token)
    company = get_or_create_company(db, board_token, company_name)

    created = 0
    skipped = 0

    for raw_job in raw_jobs:
        # Ashby's public payload does not document a stable job ID field.
        # jobUrl is stable for a specific posting and is used as the provider key.
        external_job_id = raw_job.get("jobUrl")
        application_url = raw_job.get("applyUrl")
        source_url = raw_job.get("jobUrl")

        if not isinstance(external_job_id, str) or not external_job_id:
            continue

        if not isinstance(application_url, str) or not application_url:
            continue

        existing = db.scalar(
            select(Job).where(
                Job.source == "ashby",
                Job.external_job_id == external_job_id,
            )
        )

        if existing is not None:
            existing.last_seen_at = datetime.utcnow()
            skipped += 1
            continue

        title = raw_job.get("title")
        if not isinstance(title, str) or not title.strip():
            title = "Untitled"

        description = raw_job.get("descriptionPlain")
        if not isinstance(description, str):
            description = ""

        workplace_type = raw_job.get("workplaceType")
        if not isinstance(workplace_type, str) or not workplace_type:
            workplace_type = "Remote" if raw_job.get("isRemote") else "Unknown"

        job = Job(
            company_id=company.id,
            company_name=company.name,
            source="ashby",
            source_type="company_ats",
            external_job_id=external_job_id,
            title=title.strip(),
            location=normalize_location(raw_job),
            workplace_type=workplace_type,
            description=description,
            application_url=application_url,
            source_url=source_url if isinstance(source_url, str) else None,
            status="new",
            match_score=calculate_match_score(title, description),
            posted_at=parse_ashby_datetime(raw_job.get("publishedAt")),
        )
        db.add(job)
        created += 1

    db.commit()

    return {
        "fetched": len(raw_jobs),
        "created": created,
        "skipped": skipped,
    }


def sync_all_ashby_companies(db: Session) -> list[dict]:
    """Synchronize all enabled Ashby companies stored in the database."""
    companies = db.scalars(
        select(Company).where(
            Company.source_type == "ashby",
            Company.active.is_(True),
        )
    ).all()

    results: list[dict] = []

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
            result = sync_ashby_jobs(db, company.board_token, company.name)
            results.append({"company": company.name, **result})
        except ValueError as exc:
            results.append({"company": company.name, "error": str(exc)})

    return results
