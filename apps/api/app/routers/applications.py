import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Application, Job, Resume
from app.schemas import (
    ApplicationByJobUpdate,
    ApplicationCreate,
    ApplicationJobState,
    ApplicationJobStateMap,
    ApplicationOut,
    ApplicationUpdate,
    ApplicationWithJobOut,
)

router = APIRouter(prefix="/applications", tags=["applications"])


# TODO: replace with real authenticated user once auth is implemented.
INITIAL_USER_ID = uuid.UUID("363a7386-c17c-43ab-ad6c-9a60ff52492a")


@router.get("", response_model=list[ApplicationWithJobOut])
def list_applications(
    response: Response,
    status: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    statement = (
        select(Application, Job)
        .join(Job, Job.id == Application.job_id)
        .where(Application.user_id == INITIAL_USER_ID)
    )

    if status and status.strip():
        statement = statement.where(Application.status == status.strip().lower())

    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0

    rows = db.execute(
        statement.order_by(
            Application.applied_at.desc().nullslast(),
            Application.updated_at.desc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Total-Pages"] = str((total + limit - 1) // limit)

    return [
        {
            "id": application.id,
            "job_id": application.job_id,
            "resume_id": application.resume_id,
            "status": application.status,
            "applied_at": application.applied_at,
            "notes": application.notes,
            "created_at": application.created_at,
            "updated_at": application.updated_at,
            "job": {
                "id": job.id,
                "company_name": job.company_name,
                "source": job.source,
                "title": job.title,
                "location": job.location,
                "workplace_type": job.workplace_type,
                "application_url": job.application_url,
            },
        }
        for application, job in rows
    ]


@router.get("/me/job-states", response_model=ApplicationJobStateMap)
def get_my_job_states(
    job_id: list[uuid.UUID] = Query(default=[]),
    db: Session = Depends(get_db),
) -> ApplicationJobStateMap:
    if not job_id:
        return ApplicationJobStateMap(states={})

    applications = list(
        db.scalars(
            select(Application).where(
                Application.user_id == INITIAL_USER_ID,
                Application.job_id.in_(job_id),
            )
        )
    )

    states = {
        str(application.job_id): ApplicationJobState(
            id=application.id,
            job_id=application.job_id,
            resume_id=application.resume_id,
            status=application.status,
            applied_at=application.applied_at,
            notes=application.notes,
        )
        for application in applications
    }

    return ApplicationJobStateMap(states=states)


@router.put("/by-job/{job_id}", response_model=ApplicationOut)
def upsert_application_for_job(
    job_id: uuid.UUID,
    payload: ApplicationByJobUpdate,
    db: Session = Depends(get_db),
) -> Application:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    update_fields = payload.model_fields_set

    if "resume_id" in update_fields and payload.resume_id is not None:
        resume = db.get(Resume, payload.resume_id)
        if resume is None or resume.user_id != INITIAL_USER_ID:
            raise HTTPException(status_code=404, detail="Resume not found")

    application = db.scalar(
        select(Application).where(
            Application.user_id == INITIAL_USER_ID,
            Application.job_id == job_id,
        )
    )

    if application is None:
        application = Application(
            user_id=INITIAL_USER_ID,
            job_id=job_id,
            resume_id=payload.resume_id,
            status=payload.status,
            applied_at=datetime.utcnow() if payload.status == "applied" else None,
            notes=payload.notes,
        )
        db.add(application)
    else:
        application.status = payload.status

        if "resume_id" in update_fields:
            application.resume_id = payload.resume_id
        if "notes" in update_fields:
            application.notes = payload.notes

        if payload.status == "applied" and application.applied_at is None:
            application.applied_at = datetime.utcnow()

    db.commit()
    db.refresh(application)
    return application


@router.delete("/by-job/{job_id}", status_code=204)
def delete_application_for_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    application = db.scalar(
        select(Application).where(
            Application.user_id == INITIAL_USER_ID,
            Application.job_id == job_id,
        )
    )

    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(application)
    db.commit()


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
