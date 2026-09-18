import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Application, FollowUp, Interview, Job, User
from app.schemas import (
    DashboardFollowUpsOut,
    DashboardSummaryOut,
    TodayPrioritiesOut,
    TodayPriorityGroup,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

TODAY_GROUPS = (
    ("overdue_follow_ups", 1),
    ("interviews_today", 2),
    ("follow_ups_due_today", 3),
    ("upcoming_interviews", 4),
    ("applications_needing_update", 5),
)


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


@router.get("/today", response_model=TodayPrioritiesOut)
def get_today_priorities(
    timezone_name: str = Query(alias="timezone", min_length=1, max_length=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TodayPrioritiesOut:
    try:
        requested_timezone = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise HTTPException(status_code=422, detail="Invalid IANA timezone") from error

    now_utc = datetime.now(timezone.utc)
    local_date = now_utc.astimezone(requested_timezone).date()
    local_start = datetime.combine(local_date, time.min, requested_timezone)
    local_next_start = datetime.combine(
        local_date + timedelta(days=1),
        time.min,
        requested_timezone,
    )
    utc_start = local_start.astimezone(timezone.utc)
    utc_next_start = local_next_start.astimezone(timezone.utc)

    follow_up_rows = db.execute(
        select(FollowUp, Job)
        .join(Application, Application.id == FollowUp.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(
            FollowUp.user_id == current_user.id,
            Application.user_id == current_user.id,
            FollowUp.completed_at.is_(None),
            FollowUp.due_at_utc < utc_next_start,
        )
        .order_by(FollowUp.due_at_utc.asc(), FollowUp.id.asc())
    ).all()

    overdue_follow_ups = []
    due_today_follow_ups = []
    for follow_up, job in follow_up_rows:
        item = {
            "id": follow_up.id,
            "action_kind": "follow_up",
            "title": follow_up.title,
            "application_id": follow_up.application_id,
            "company_name": job.company_name,
            "job_title": job.title,
            "interview_id": follow_up.interview_id,
            "occurs_at": follow_up.due_at_utc,
            "timezone": follow_up.timezone,
            "status": "pending",
        }
        if follow_up.due_at_utc < utc_start:
            overdue_follow_ups.append(item)
        else:
            due_today_follow_ups.append(item)

    # Interview.scheduled_at is the project's legacy UTC-naive column.
    interview_utc_start = utc_start.replace(tzinfo=None)
    interview_utc_next_start = utc_next_start.replace(tzinfo=None)
    interview_rows = db.execute(
        select(Interview, Job)
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(
            Application.user_id == current_user.id,
            Interview.scheduled_at.is_not(None),
            Interview.scheduled_at >= interview_utc_start,
            Interview.status != "cancelled",
        )
        .order_by(Interview.scheduled_at.asc(), Interview.id.asc())
    ).all()

    interviews_today = []
    upcoming_interviews = []
    for interview, job in interview_rows:
        item = {
            "id": interview.id,
            "action_kind": "interview",
            "title": interview.title,
            "application_id": interview.application_id,
            "company_name": job.company_name,
            "job_title": job.title,
            "interview_id": interview.id,
            "occurs_at": interview.scheduled_at.replace(tzinfo=timezone.utc),
            "timezone": interview.timezone,
            "status": interview.status,
        }
        if interview.scheduled_at < interview_utc_next_start:
            interviews_today.append(item)
        else:
            upcoming_interviews.append(item)

    items_by_group = {
        "overdue_follow_ups": overdue_follow_ups,
        "interviews_today": interviews_today,
        "follow_ups_due_today": due_today_follow_ups,
        "upcoming_interviews": upcoming_interviews,
        # No current explicit application-staleness convention exists.
        "applications_needing_update": [],
    }
    return TodayPrioritiesOut(
        timezone=timezone_name,
        local_date=local_date,
        groups=[
            TodayPriorityGroup(key=key, priority=priority, items=items_by_group[key])
            for key, priority in TODAY_GROUPS
        ],
    )
