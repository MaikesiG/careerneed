import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Application, Interview, Job, User
from app.schemas import (
    FastCaptureRequest,
    InterviewCreate,
    InterviewExtraction,
    InterviewOut,
    InterviewUpdate,
    UpcomingInterviewOut,
)
from app.services.interview_extractor import extract_interview

router = APIRouter(tags=["interviews"])


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


def _get_owned_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> Interview:
    _get_owned_application(application_id, current_user, db)
    interview = db.scalar(
        select(Interview).where(
            Interview.id == interview_id,
            Interview.application_id == application_id,
        )
    )
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@router.get(
    "/applications/{application_id}/interviews",
    response_model=list[InterviewOut],
)
def list_application_interviews(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Interview]:
    _get_owned_application(application_id, current_user, db)

    return list(
        db.scalars(
            select(Interview)
            .where(Interview.application_id == application_id)
            .order_by(Interview.round.asc(), Interview.scheduled_at.asc().nullslast())
        )
    )


@router.post(
    "/applications/{application_id}/interviews",
    response_model=InterviewOut,
    status_code=201,
)
def create_application_interview(
    application_id: uuid.UUID,
    payload: InterviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Interview:
    _get_owned_application(application_id, current_user, db)

    create_data = payload.model_dump()
    # If round is default 1 and other interviews exist, calculate round if user didn't explicitly override
    existing_count = db.scalar(
        select(func.count(Interview.id)).where(
            Interview.application_id == application_id
        )
    ) or 0

    if "round" not in payload.model_fields_set:
        create_data["round"] = existing_count + 1

    interview = Interview(
        application_id=application_id,
        **create_data,
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


@router.get(
    "/applications/{application_id}/interviews/{interview_id}",
    response_model=InterviewOut,
)
def get_application_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Interview:
    return _get_owned_interview(application_id, interview_id, current_user, db)


@router.patch(
    "/applications/{application_id}/interviews/{interview_id}",
    response_model=InterviewOut,
)
def update_application_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    payload: InterviewUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Interview:
    interview = _get_owned_interview(application_id, interview_id, current_user, db)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(interview, field, value)

    interview.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(interview)
    return interview


@router.delete(
    "/applications/{application_id}/interviews/{interview_id}",
    status_code=204,
)
def delete_application_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    interview = _get_owned_interview(application_id, interview_id, current_user, db)
    db.delete(interview)
    db.commit()
    return Response(status_code=204)


@router.get(
    "/interviews/upcoming",
    response_model=list[UpcomingInterviewOut],
)
def list_upcoming_interviews(
    days: int = Query(default=30, ge=1, le=365),
    include_past: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return upcoming interviews for current user across all applications."""
    now = datetime.utcnow()
    max_date = now + timedelta(days=days)

    statement = (
        select(Interview, Job)
        .join(Application, Application.id == Interview.application_id)
        .join(Job, Job.id == Application.job_id)
        .where(Application.user_id == current_user.id)
    )

    if not include_past:
        statement = statement.where(
            Interview.scheduled_at.is_not(None),
            Interview.scheduled_at >= now - timedelta(hours=12),
            Interview.scheduled_at <= max_date,
        )
    else:
        statement = statement.where(Interview.scheduled_at.is_not(None))

    rows = db.execute(
        statement.order_by(Interview.scheduled_at.asc())
    ).all()

    results = []
    for interview, job in rows:
        item = {
            "id": interview.id,
            "application_id": interview.application_id,
            "round": interview.round,
            "title": interview.title,
            "interview_type": interview.interview_type,
            "scheduled_at": interview.scheduled_at,
            "duration_minutes": interview.duration_minutes,
            "timezone": interview.timezone,
            "status": interview.status,
            "result": interview.result,
            "interviewer_name": interview.interviewer_name,
            "interviewer_title": interview.interviewer_title,
            "interviewer_email": interview.interviewer_email,
            "meeting_url": interview.meeting_url,
            "location": interview.location,
            "notes": interview.notes,
            "preparation_notes": interview.preparation_notes,
            "created_at": interview.created_at,
            "updated_at": interview.updated_at,
            "company_name": job.company_name,
            "job_title": job.title,
        }
        results.append(item)

    return results


@router.post(
    "/interviews/fast-capture",
    response_model=InterviewExtraction,
)
def fast_capture_interview(
    payload: FastCaptureRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InterviewExtraction:
    """Extract structured interview details from unstructured text for user confirmation."""
    if not payload.raw_text.strip():
        raise HTTPException(status_code=422, detail="Text cannot be empty")

    return extract_interview(
        db=db,
        user_id=current_user.id,
        raw_text=payload.raw_text,
        application_id=payload.application_id,
    )
