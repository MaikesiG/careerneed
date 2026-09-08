import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Application, Job, Resume
from app.schemas import ApplicationCreate, ApplicationOut, ApplicationUpdate

router = APIRouter(prefix="/applications", tags=["applications"])


# TODO: replace with real authenticated user once auth is implemented.
INITIAL_USER_ID = uuid.UUID("363a7386-c17c-43ab-ad6c-9a60ff52492a")


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    status: str | None = Query(default=None),
    job_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Application]:
    stmt = (
        select(Application)
        .where(Application.user_id == INITIAL_USER_ID)
        .order_by(Application.created_at.desc())
    )
    if status:
        stmt = stmt.where(Application.status == status)
    if job_id:
        stmt = stmt.where(Application.job_id == job_id)
    return list(db.scalars(stmt))


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(application_id: uuid.UUID, db: Session = Depends(get_db)) -> Application:
    application = db.get(Application, application_id)
    if application is None or application.user_id != INITIAL_USER_ID:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.post("", response_model=ApplicationOut, status_code=201)
def save_job(payload: ApplicationCreate, db: Session = Depends(get_db)) -> Application:
    job = db.get(Job, payload.job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if payload.resume_id is not None:
        resume = db.get(Resume, payload.resume_id)
        if resume is None or resume.user_id != INITIAL_USER_ID:
            raise HTTPException(status_code=404, detail="Resume not found")

    existing = db.scalar(
        select(Application).where(
            Application.user_id == INITIAL_USER_ID,
            Application.job_id == payload.job_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="This job has already been saved or applied to")

    application = Application(
        user_id=INITIAL_USER_ID,
        job_id=payload.job_id,
        resume_id=payload.resume_id,
        status=payload.status,
        applied_at=datetime.utcnow() if payload.status == "applied" else None,
        notes=payload.notes,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.patch("/{application_id}", response_model=ApplicationOut)
def update_application(
    application_id: uuid.UUID, payload: ApplicationUpdate, db: Session = Depends(get_db)
) -> Application:
    application = db.get(Application, application_id)
    if application is None or application.user_id != INITIAL_USER_ID:
        raise HTTPException(status_code=404, detail="Application not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("resume_id") is not None:
        resume = db.get(Resume, update_data["resume_id"])
        if resume is None or resume.user_id != INITIAL_USER_ID:
            raise HTTPException(status_code=404, detail="Resume not found")

    if update_data.get("status") == "applied" and application.applied_at is None:
        update_data.setdefault("applied_at", datetime.utcnow())

    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", status_code=204)
def delete_application(application_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    application = db.get(Application, application_id)
    if application is None or application.user_id != INITIAL_USER_ID:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(application)
    db.commit()
