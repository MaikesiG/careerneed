import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.auth import get_optional_current_user
from app.connectors.scoring import calculate_match_score
from app.database import get_db
from app.models import Application, Job, User
from app.normalization import normalize_workplace_type, workplace_type_filter_values
from app.schemas import JobDetail, JobManualCreate, JobOut, JobStatusUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


ALLOWED_APPLICATION_STATUSES = {
    "saved",
    "applied",
    "interviewing",
    "offer",
    "rejected",
    "withdrawn",
}

SORT_COLUMNS = {
    "recent": func.coalesce(Job.posted_at, Job.first_seen_at),
    "match_score": Job.match_score,
}

CURATED_KEYWORDS = [
    # Software & IT
    "software engineer",
    "frontend engineer",
    "backend engineer",
    "full stack engineer",
    "devops",
    "site reliability",
    "sre",
    "infrastructure engineer",
    "security engineer",
    # Data & AI
    "data analyst",
    "data scientist",
    "data engineer",
    "analytics engineer",
    "business intelligence",
    "machine learning engineer",
    "ml engineer",
    "ai engineer",
    "research scientist",
    # Product & Design
    "product manager",
    "technical product manager",
    "product designer",
    "ux designer",
    "ui designer",
    "ux researcher",
    # Business, Finance & Operations
    "financial analyst",
    "fp&a",
    "accountant",
    "operations analyst",
    "business operations",
    "supply chain analyst",
    "strategy consultant",
    # Marketing, Sales & People
    "growth marketing",
    "marketing manager",
    "account executive",
    "sales engineer",
    "business development",
    "technical recruiter",
    "people operations",
]


@router.get("", response_model=list[JobOut])
def list_jobs(
    response: Response,
    q: str | None = Query(default=None, max_length=200),
    location_query: str | None = Query(default=None, max_length=100),
    source: list[str] = Query(default=[]),
    source_type: str | None = Query(default=None, max_length=50),
    workplace_type: list[str] = Query(default=[]),
    category: list[str] | None = Query(default=None),
    keywords: list[str] = Query(default=[]),
    status: str | None = Query(default=None, max_length=50),
    application_status: list[str] = Query(default=[]),
    min_match_score: int | None = Query(default=None, ge=0, le=100),
    date_range: str = Query(default="all", pattern="^(all|yesterday|week|month)$"),
    sort: str = Query(default="match_score", pattern="^(recent|match_score)$"),
    sort_direction: str = Query(default="desc", pattern="^(asc|desc)$"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[Job]:
    statement = select(Job)

    requested_application_statuses = {
        value.strip().lower() for value in application_status if value and value.strip()
    }

    invalid_application_statuses = requested_application_statuses - ALLOWED_APPLICATION_STATUSES

    if invalid_application_statuses:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid application status: " + ", ".join(sorted(invalid_application_statuses))
            ),
        )

    if requested_application_statuses:
        if current_user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")

        statement = statement.join(
            Application,
            Application.job_id == Job.id,
        ).where(
            Application.user_id == current_user.id,
            Application.status.in_(requested_application_statuses),
        )

    if status and status.strip():
        statement = statement.where(Job.status == status.strip().lower())

    providers = {value.strip().lower() for value in source if value and value.strip()}

    if source_type and source_type.strip():
        providers.add(source_type.strip().lower())

    if providers:
        statement = statement.where(func.lower(Job.source).in_(providers))

    workplace_types = {value.strip().lower() for value in workplace_type if value and value.strip()}

    if workplace_types:
        historical_workplace_types = set().union(
            *(workplace_type_filter_values(value) for value in workplace_types)
        )
        compact_workplace_type = func.lower(
            func.regexp_replace(
                func.lower(func.coalesce(Job.workplace_type, "")),
                "[^a-z]",
                "",
                "g",
            )
        )
        statement = statement.where(compact_workplace_type.in_(historical_workplace_types))

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Job.title.ilike(search_term),
                Job.company_name.ilike(search_term),
                func.coalesce(Job.location, "").ilike(search_term),
            )
        )

    if location_query and location_query.strip():
        location_term = f"%{location_query.strip()}%"
        statement = statement.where(
            func.coalesce(Job.location, "").ilike(location_term)
        )

    cleaned_keywords = [keyword.strip() for keyword in keywords if keyword and keyword.strip()]

    legacy_category_keywords: dict[str, list[str]] = {
        "software": ["software engineer", "backend engineer", "frontend engineer", "full stack"],
        "data": ["data analyst", "data scientist", "data engineer", "analytics", "business intelligence", "sql"],
        "ai": ["machine learning", "ai engineer", "applied scientist", "research scientist", "llm"],
        "design": ["product designer", "ux designer", "ui designer", "ux researcher"],
        "product": ["product manager", "product operations", "product analyst"],
        "finance": ["financial analyst", "investment analyst", "accountant", "fp&a"],
        "marketing": ["growth marketing", "marketing manager", "content marketing", "seo"],
        "sales": ["account executive", "sales engineer", "business development", "sdr"],
        "operations": ["operations analyst", "business operations", "supply chain", "logistics"],
        "people": ["recruiter", "talent acquisition", "people operations", "hrbp"],
        # Backward compatibility
        "mlops": ["mlops", "ml infrastructure", "ai infrastructure", "ml platform"],
        "hardware": ["kernel", "gpu", "tpu", "compiler", "distributed training", "cuda"],
        "sre": ["site reliability", "sre", "platform engineer"],
        "platform": ["platform engineer", "infrastructure engineer"],
        "ai-agent": ["ai agent", "agent engineer", "llm", "prompt engineering"],
    }

    selected_categories = [
        item.strip().lower()
        for item in (category or [])
        if item and item.strip().lower() in legacy_category_keywords
    ]

    for category_id in selected_categories:
        cleaned_keywords.extend(legacy_category_keywords[category_id])

    if cleaned_keywords:
        keyword_conditions = [
            or_(
                Job.title.ilike(f"%{keyword}%"),
                Job.company_name.ilike(f"%{keyword}%"),
                func.coalesce(Job.description, "").ilike(f"%{keyword}%"),
            )
            for keyword in cleaned_keywords
        ]
        statement = statement.where(or_(*keyword_conditions))

    if min_match_score is not None:
        statement = statement.where(func.coalesce(Job.match_score, 0) >= min_match_score)

    effective_date = func.coalesce(Job.posted_at, Job.first_seen_at)
    now = datetime.utcnow()

    date_range_start = {
        "yesterday": now - timedelta(days=1),
        "week": now - timedelta(days=7),
        "month": now - timedelta(days=30),
    }

    if date_range in date_range_start:
        statement = statement.where(effective_date >= date_range_start[date_range])

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0

    sort_column = SORT_COLUMNS[sort]
    order_clause = (
        sort_column.asc().nullslast() if sort_direction == "asc" else sort_column.desc().nullslast()
    )

    jobs = db.scalars(
        statement.order_by(order_clause, Job.first_seen_at.desc()).offset(offset).limit(limit)
    ).all()

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Total-Pages"] = str((total + limit - 1) // limit)

    return jobs


@router.get("/keyword-suggestions")
def get_keyword_suggestions(
    q: str = Query(default="", max_length=100),
) -> dict[str, list[dict[str, str]]]:
    query = q.strip().lower()

    if not query:
        matches = CURATED_KEYWORDS[:10]
    else:
        matches = [keyword for keyword in CURATED_KEYWORDS if query in keyword][:10]

    return {
        "suggestions": [
            {"value": keyword, "label": keyword.title(), "source": "curated"} for keyword in matches
        ]
    }


@router.get("/{job_id}", response_model=JobDetail)
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.patch("/{job_id}/status", response_model=JobOut)
def update_job_status(
    job_id: uuid.UUID, payload: JobStatusUpdate, db: Session = Depends(get_db)
) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = payload.status
    db.commit()
    db.refresh(job)
    return job


@router.post("/manual", response_model=JobOut, status_code=201)
def create_manual_job(
    payload: JobManualCreate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
) -> Job:
    job = Job(
        company_name=payload.company_name,
        source="manual",
        source_type="manual_user_entry",
        title=payload.title,
        location=payload.location,
        workplace_type=normalize_workplace_type(payload.workplace_type),
        description=payload.description,
        application_url=payload.application_url,
        source_url=payload.source_url,
        status="saved",
        match_score=calculate_match_score(payload.title, payload.description or ""),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if current_user:
        existing_app = db.scalar(
            select(Application).where(
                Application.user_id == current_user.id,
                Application.job_id == job.id,
            )
        )
        if not existing_app:
            app_record = Application(
                user_id=current_user.id,
                job_id=job.id,
                status="saved",
                notes=payload.notes,
            )
            db.add(app_record)
            db.commit()

    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
