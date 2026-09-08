import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.connectors.scoring import calculate_match_score
from app.database import get_db
from app.models import Job
from app.schemas import JobDetail, JobManualCreate, JobOut, JobStatusUpdate

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobOut])
def list_jobs(
    response: Response,
    status: str | None = Query(default=None),
    location: str | None = Query(default=None),
    limit: int = Query(default=500, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Job]:
    stmt = select(Job).order_by(Job.first_seen_at.desc())
    if status:
        stmt = stmt.where(Job.status == status)
    if location:
        stmt = stmt.where(Job.location.ilike(f"%{location}%"))

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    response.headers["X-Total-Count"] = str(total)

    stmt = stmt.limit(limit).offset(offset)
    return list(db.scalars(stmt))


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
