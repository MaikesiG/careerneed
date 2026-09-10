import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.connectors.scoring import calculate_match_score
from app.database import get_db
from app.models import Job
from app.schemas import JobDetail, JobManualCreate, JobOut, JobStatusUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobOut])
def list_jobs(
    response: Response,
    q: str | None = Query(default=None, max_length=200),
    source: str | None = Query(default=None, max_length=50),
    source_type: str | None = Query(default=None, max_length=50),
    workplace_type: str | None = Query(default=None, max_length=50),
    category: list[str] | None = Query(default=None),
    status: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Job]:
    statement = select(Job)

    if status and status.strip():
        statement = statement.where(Job.status == status.strip().lower())

    provider = (source or source_type or "").strip().lower()

    if provider:
        statement = statement.where(Job.source == provider)

    if workplace_type and workplace_type.strip():
        statement = statement.where(
            func.lower(func.coalesce(Job.workplace_type, "")) == workplace_type.strip().lower()
        )

    if q and q.strip():
        search_term = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Job.title.ilike(search_term),
                Job.company_name.ilike(search_term),
                Job.location.ilike(search_term),
            )
        )

    category_keywords: dict[str, list[str]] = {
        "mlops": [
            "mlops",
            "ml infrastructure",
            "ai infrastructure",
            "ml platform",
            "ai platform",
        ],
        "hardware": [
            "kernel",
            "gpu",
            "tpu",
            "compiler",
            "distributed training",
            "cluster",
            "cuda",
        ],
        "sre": ["site reliability", "sre"],
        "platform": ["platform engineer", "infrastructure engineer"],
        "software": ["software engineer", "backend engineer"],
        "ai-agent": ["ai agent", "agent engineer", "llm", "prompt engineering"],
    }

    selected_categories = [
        item.strip().lower()
        for item in (category or [])
        if item and item.strip().lower() in category_keywords
    ]

    if selected_categories:
        category_conditions = []

        for category_id in selected_categories:
            for keyword in category_keywords[category_id]:
                search_term = f"%{keyword}%"
                category_conditions.append(
                    or_(
                        Job.title.ilike(search_term),
                        Job.company_name.ilike(search_term),
                    )
                )

        statement = statement.where(or_(*category_conditions))

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0

    jobs = db.scalars(
        statement.order_by(Job.first_seen_at.desc()).offset(offset).limit(limit)
    ).all()

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Total-Pages"] = str((total + limit - 1) // limit)

    return jobs


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
def create_manual_job(payload: JobManualCreate, db: Session = Depends(get_db)) -> Job:
    job = Job(
        company_name=payload.company_name,
        source="manual",
        source_type="manual_user_entry",
        title=payload.title,
        location=payload.location,
        workplace_type=payload.workplace_type,
        description=payload.description,
        application_url=payload.application_url,
        source_url=payload.source_url,
        status="saved",
        match_score=calculate_match_score(payload.title, payload.description or ""),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
