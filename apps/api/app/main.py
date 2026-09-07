import uuid

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.connectors.greenhouse import sync_all_greenhouse_companies, sync_greenhouse_jobs
from app.connectors.lever import sync_all_lever_companies, sync_lever_jobs
from app.database import Base, engine, get_db
from app.models import Company, Job
from app.schemas import (
    CompanyCreate,
    CompanyOut,
    JobDetail,
    JobManualCreate,
    JobOut,
    JobStatusUpdate,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Careerneed API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": "careerneed-api"}


@app.get("/jobs", response_model=list[JobOut], tags=["jobs"])
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


@app.get("/jobs/{job_id}", response_model=JobDetail, tags=["jobs"])
def get_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.patch("/jobs/{job_id}/status", response_model=JobOut, tags=["jobs"])
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


@app.post("/jobs/manual", response_model=JobOut, status_code=201, tags=["jobs"])
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
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@app.get("/companies", response_model=list[CompanyOut], tags=["companies"])
def list_companies(db: Session = Depends(get_db)) -> list[Company]:
    return list(db.scalars(select(Company).order_by(Company.name)))


@app.post("/companies", response_model=CompanyOut, status_code=201, tags=["companies"])
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)) -> Company:
    company = Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@app.post("/connectors/greenhouse/sync")
def sync_greenhouse(board_token: str, company_name: str, db: Session = Depends(get_db)):
    try:
        return sync_greenhouse_jobs(db, board_token, company_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/connectors/greenhouse/sync-all")
def sync_all_greenhouse(db: Session = Depends(get_db)):
    results = sync_all_greenhouse_companies(db)
    return {"companies_synced": len(results), "results": results}


@app.post("/connectors/lever/sync")
def sync_lever(company_slug: str, company_name: str, db: Session = Depends(get_db)):
    try:
        return sync_lever_jobs(db, company_slug, company_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/connectors/lever/sync-all")
def sync_all_lever(db: Session = Depends(get_db)):
    results = sync_all_lever_companies(db)
    return {"companies_synced": len(results), "results": results}
