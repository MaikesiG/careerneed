import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Application, Job, User
from app.schemas import DashboardFollowUpsOut, DashboardSummaryOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def count_applications(
    db: Session,
    user_id: uuid.UUID,
    *conditions: object,
) -> int:
    statement = (
        select(func.count())
        .select_from(Application)
        .where(
            Application.user_id == user_id,
            *conditions,
        )
    )
    return db.scalar(statement) or 0


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryOut:
    today = date.today()

    applications_saved = count_applications(
        db,
        current_user.id,
        Application.status == "saved",
    )
    applications_applied = count_applications(
        db,
        current_user.id,
        Application.status == "applied",
    )
    applications_interviewing = count_applications(
        db,
        current_user.id,
        Application.status == "interviewing",
    )

    return DashboardSummaryOut(
        follow_ups_due_today=count_applications(
            db,
            current_user.id,
            Application.follow_up_on == today,
        ),
        follow_ups_overdue=count_applications(
            db,
            current_user.id,
            Application.follow_up_on.is_not(None),
            Application.follow_up_on < today,
        ),
        applications_saved=applications_saved,
        applications_applied=applications_applied,
        applications_interviewing=applications_interviewing,
        active_applications=applications_applied + applications_interviewing,
    )


@router.get("/follow-ups", response_model=DashboardFollowUpsOut)
def get_dashboard_follow_ups(
    limit: int = Query(default=6, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardFollowUpsOut:
    today = date.today()

    rows = db.execute(
        select(Application, Job)
        .join(Job, Job.id == Application.job_id)
        .where(
            Application.user_id == current_user.id,
            Application.follow_up_on.is_not(None),
            Application.follow_up_on <= today,
        )
        .order_by(
            Application.follow_up_on.asc(),
            Application.updated_at.desc(),
        )
        .limit(limit)
    ).all()

    return DashboardFollowUpsOut(
        items=[
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
            }
            for application, job in rows
        ]
    )
