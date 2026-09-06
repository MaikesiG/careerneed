from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Company, Job

GREENHOUSE_API_BASE = "https://boards-api.greenhouse.io/v1/boards"

HIGH_PRIORITY_KEYWORDS = [
    "mlops",
    "ml infrastructure",
    "ai infrastructure",
    "ml platform",
    "ai platform",
    "machine learning infrastructure",
]
HARDWARE_INFRA_KEYWORDS = [
    "kernel",
    "gpu",
    "tpu",
    "compiler",
    "distributed training",
    "inference optimization",
    "cluster",
    "cuda",
]
MEDIUM_PRIORITY_KEYWORDS = [
    "site reliability",
    "sre",
    "platform engineer",
    "infrastructure engineer",
]
LOW_PRIORITY_KEYWORDS = [
    "ai agent",
    "agent engineer",
    "llm",
    "prompt engineering",
]
AI_ML_CONTEXT_KEYWORDS = [
    "ai",
    "ml",
    "machine learning",
    "model",
    "llm",
    "inference",
    "gpu",
]
BASE_KEYWORDS = ["software engineer", "backend engineer", "platform"]

EXCLUDE_TITLE_PATTERNS = [
    "account executive",
    "recruiter",
    "economist",
    "counsel",
    "paralegal",
    "warehouse",
    "applied ai architect",
    "program manager",
    "director",
]
ENGINEERING_MANAGER_ALLOW = [
    "engineering manager",
    "infrastructure manager",
    "platform manager",
    "sre manager",
    "site reliability manager",
]


def is_non_engineering_title(title_lower: str) -> bool:
    if any(allow in title_lower for allow in ENGINEERING_MANAGER_ALLOW):
        return False
    if "manager" in title_lower:
        return True
    return any(p in title_lower for p in EXCLUDE_TITLE_PATTERNS)


def calculate_match_score(title: str, description: str) -> int:
    text = f"{title} {description}".lower()
    title_lower = title.lower()
    score = 0

    if is_non_engineering_title(title_lower):
        return min(score, 15)

    for kw in HIGH_PRIORITY_KEYWORDS + HARDWARE_INFRA_KEYWORDS:
        if kw in text:
            score += 40
            break

    for kw in MEDIUM_PRIORITY_KEYWORDS:
        if kw in text:
            has_ai_context = any(ctx in text for ctx in AI_ML_CONTEXT_KEYWORDS)
            score += 30 if has_ai_context else 15
            break

    for kw in LOW_PRIORITY_KEYWORDS:
        if kw in text:
            score += 20
            break

    for kw in BASE_KEYWORDS:
        if kw in text:
            score += 10
            break

    return min(score, 100)


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

        location = (raw.get("location") or {}).get("name", "Remote")
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
