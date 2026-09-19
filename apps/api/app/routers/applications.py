import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Application,
    ApplicationContact,
    Contact,
    FollowUp,
    Job,
    Resume,
    User,
)
from app.schemas import (
    ApplicationByJobUpdate,
    ApplicationContactCreate,
    ApplicationContactOut,
    ApplicationContactUpdate,
    ApplicationCreate,
    ApplicationJobState,
    ApplicationJobStateMap,
    ApplicationListItemOut,
    ApplicationOut,
    ApplicationUpdate,
    ApplicationWithJobOut,
)

router = APIRouter(prefix="/applications", tags=["applications"])

ALLOWED_FOLLOW_UP_FILTERS = {"all", "today", "overdue", "scheduled"}


@router.get("", response_model=list[ApplicationListItemOut])
def list_applications(
    response: Response,
    status: str | None = Query(default=None, max_length=50),
    follow_up: str = Query(default="all", max_length=20),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    open_follow_up_summary = (
        select(
            FollowUp.application_id.label("application_id"),
            func.min(FollowUp.due_at_utc).label("next_open_follow_up_at"),
            func.count(FollowUp.id).label("open_follow_up_count"),
        )
        .where(
            FollowUp.user_id == current_user.id,
            FollowUp.completed_at.is_(None),
        )
        .group_by(FollowUp.application_id)
        .subquery()
    )

    statement = (
        select(
            Application,
            Job,
            open_follow_up_summary.c.next_open_follow_up_at,
            func.coalesce(open_follow_up_summary.c.open_follow_up_count, 0).label(
                "open_follow_up_count"
            ),
        )
        .join(Job, Job.id == Application.job_id)
        .outerjoin(
            open_follow_up_summary,
            open_follow_up_summary.c.application_id == Application.id,
        )
        .where(Application.user_id == current_user.id)
    )

    follow_up_filter = follow_up.strip().lower()

    if follow_up_filter not in ALLOWED_FOLLOW_UP_FILTERS:
        raise HTTPException(
            status_code=422,
            detail="Invalid follow-up filter. Use all, today, overdue, or scheduled.",
        )

    if status and status.strip():
        statement = statement.where(Application.status == status.strip().lower())

    today = date.today()

    if follow_up_filter == "today":
        statement = statement.where(Application.follow_up_on == today)
    elif follow_up_filter == "overdue":
        statement = statement.where(Application.follow_up_on < today)
    elif follow_up_filter == "scheduled":
        statement = statement.where(Application.follow_up_on.is_not(None))

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
            "follow_up_on": application.follow_up_on,
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
            "next_open_follow_up_at": next_open_follow_up_at,
            "open_follow_up_count": open_follow_up_count,
        }
        for application, job, next_open_follow_up_at, open_follow_up_count in rows
    ]


@router.get("/me/job-states", response_model=ApplicationJobStateMap)
def get_my_job_states(
    job_id: list[uuid.UUID] = Query(default=[]),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApplicationJobStateMap:
    if not job_id:
        return ApplicationJobStateMap(states={})

    applications = list(
        db.scalars(
            select(Application).where(
                Application.user_id == current_user.id,
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
            follow_up_on=application.follow_up_on,
        )
        for application in applications
    }

    return ApplicationJobStateMap(states=states)


@router.put("/by-job/{job_id}", response_model=ApplicationOut)
def upsert_application_for_job(
    job_id: uuid.UUID,
    payload: ApplicationByJobUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Application:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    update_fields = payload.model_fields_set

    if "resume_id" in update_fields and payload.resume_id is not None:
        resume = db.scalar(
            select(Resume).where(
                Resume.id == payload.resume_id,
                Resume.user_id == current_user.id,
            )
        )
        if resume is None:
            raise HTTPException(status_code=404, detail="Resume not found")

    application = db.scalar(
        select(Application).where(
            Application.user_id == current_user.id,
            Application.job_id == job_id,
        )
    )

    if application is None:
        application = Application(
            user_id=current_user.id,
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    application = db.scalar(
        select(Application).where(
            Application.user_id == current_user.id,
            Application.job_id == job_id,
        )
    )

    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(application)
    db.commit()


@router.get("/{application_id}", response_model=ApplicationWithJobOut)
def get_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = db.execute(
        select(Application, Job)
        .join(Job, Job.id == Application.job_id)
        .where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    ).one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Application not found")

    application, job = row

    return {
        "id": application.id,
        "job_id": application.job_id,
        "resume_id": application.resume_id,
        "status": application.status,
        "applied_at": application.applied_at,
        "notes": application.notes,
        "follow_up_on": application.follow_up_on,
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


def _get_owned_application(
    application_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> Application:
    application = db.scalar(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )

    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    return application


@router.get(
    "/{application_id}/contacts",
    response_model=list[ApplicationContactOut],
)
def list_application_contacts(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ApplicationContact]:
    _get_owned_application(application_id, current_user, db)

    return list(
        db.scalars(
            select(ApplicationContact)
            .where(ApplicationContact.application_id == application_id)
            .order_by(ApplicationContact.created_at.desc())
        )
    )


@router.post(
    "/{application_id}/contacts",
    response_model=ApplicationContactOut,
    status_code=201,
)
def create_application_contact(
    application_id: uuid.UUID,
    payload: ApplicationContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApplicationContact:
    _get_owned_application(application_id, current_user, db)
    reusable_contact: Contact | None = None
    if payload.contact_id is not None:
        reusable_contact = db.scalar(
            select(Contact).where(
                Contact.id == payload.contact_id,
                Contact.user_id == current_user.id,
            )
        )
        if reusable_contact is None:
            raise HTTPException(status_code=404, detail="Contact not found")

        existing_link = db.scalar(
            select(ApplicationContact).where(
                ApplicationContact.application_id == application_id,
                ApplicationContact.contact_id == payload.contact_id,
            )
        )
        if existing_link is not None:
            return existing_link

    contact_data = payload.model_dump()
    if payload.contact_id is not None and reusable_contact is not None:
        if not contact_data.get("name"):
            contact_data["name"] = reusable_contact.name
        if contact_data.get("contact_type") == "other" and reusable_contact.relationship_type in (
            "recruiter",
            "interviewer",
            "hiring_manager",
            "referral",
        ):
            contact_data["contact_type"] = reusable_contact.relationship_type
        if contact_data.get("email") is None:
            contact_data["email"] = reusable_contact.email
        if contact_data.get("linkedin_url") is None:
            contact_data["linkedin_url"] = reusable_contact.linkedin_url

    contact = ApplicationContact(
        application_id=application_id,
        **contact_data,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.patch(
    "/{application_id}/contacts/{contact_id}",
    response_model=ApplicationContactOut,
)
def update_application_contact(
    application_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: ApplicationContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApplicationContact:
    _get_owned_application(application_id, current_user, db)

    contact = db.scalar(
        select(ApplicationContact).where(
            ApplicationContact.id == contact_id,
            ApplicationContact.application_id == application_id,
        )
    )

    if contact is None:
        raise HTTPException(status_code=404, detail="Application contact not found")

    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("contact_id") is not None:
        reusable_contact = db.scalar(
            select(Contact).where(
                Contact.id == update_data["contact_id"],
                Contact.user_id == current_user.id,
            )
        )
        if reusable_contact is None:
            raise HTTPException(status_code=404, detail="Contact not found")

    for field, value in update_data.items():
        setattr(contact, field, value)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete(
    "/{application_id}/contacts/{contact_id}",
    status_code=204,
)
def delete_application_contact(
    application_id: uuid.UUID,
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    _get_owned_application(application_id, current_user, db)

    contact = db.scalar(
        select(ApplicationContact).where(
            ApplicationContact.id == contact_id,
            ApplicationContact.application_id == application_id,
        )
    )

    if contact is None:
        raise HTTPException(status_code=404, detail="Application contact not found")

    db.delete(contact)
    db.commit()
    return Response(status_code=204)


SUPPORTED_CANONICAL_RELATIONSHIPS = {
    "recruiter",
    "hiring_manager",
    "interviewer",
    "referral",
    "other",
}


@router.post(
    "/{application_id}/contacts/{contact_id}/make-reusable",
    response_model=ApplicationContactOut,
)
def make_application_contact_reusable(
    application_id: uuid.UUID,
    contact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApplicationContact:
    _get_owned_application(application_id, current_user, db)

    contact = db.scalar(
        select(ApplicationContact).where(
            ApplicationContact.id == contact_id,
            ApplicationContact.application_id == application_id,
        )
    )

    if contact is None:
        raise HTTPException(status_code=404, detail="Application contact not found")

    if contact.contact_id is not None:
        return contact

    relationship_type = (
        contact.contact_type
        if contact.contact_type in SUPPORTED_CANONICAL_RELATIONSHIPS
        else "other"
    )

    canonical_contact = Contact(
        user_id=current_user.id,
        name=contact.name,
        title=None,
        email=contact.email,
        linkedin_url=contact.linkedin_url,
        relationship_type=relationship_type,
        notes=None,
    )
    db.add(canonical_contact)
    db.flush()

    contact.contact_id = canonical_contact.id
    db.commit()
    db.refresh(contact)
    return contact


@router.post("", response_model=ApplicationOut, status_code=201)
def save_job(
    payload: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Application:
    job = db.get(Job, payload.job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if payload.resume_id is not None:
        resume = db.scalar(
            select(Resume).where(
                Resume.id == payload.resume_id,
                Resume.user_id == current_user.id,
            )
        )
        if resume is None:
            raise HTTPException(status_code=404, detail="Resume not found")

    existing = db.scalar(
        select(Application).where(
            Application.user_id == current_user.id,
            Application.job_id == payload.job_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="This job has already been saved or applied to")

    application = Application(
        user_id=current_user.id,
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
    application_id: uuid.UUID,
    payload: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Application:
    application = db.scalar(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("resume_id") is not None:
        resume = db.scalar(
            select(Resume).where(
                Resume.id == update_data["resume_id"],
                Resume.user_id == current_user.id,
            )
        )
        if resume is None:
            raise HTTPException(status_code=404, detail="Resume not found")

    if update_data.get("status") == "applied" and application.applied_at is None:
        update_data.setdefault("applied_at", datetime.utcnow())

    for field, value in update_data.items():
        setattr(application, field, value)

    db.commit()
    db.refresh(application)
    return application


@router.delete("/{application_id}", status_code=204)
def delete_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    application = db.scalar(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")

    db.delete(application)
    db.commit()
