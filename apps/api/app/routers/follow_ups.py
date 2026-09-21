import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Application, FollowUp, Interview, User
from app.schemas import FollowUpCreate, FollowUpOut, FollowUpUpdate

router = APIRouter(prefix="/applications", tags=["follow-ups"])


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


def _validate_owned_interview(
    application_id: uuid.UUID,
    interview_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> None:
    interview = db.scalar(
        select(Interview)
        .join(Application, Application.id == Interview.application_id)
        .where(
            Interview.id == interview_id,
            Interview.application_id == application_id,
            Application.user_id == current_user.id,
        )
    )
    if interview is None:
        raise HTTPException(status_code=404, detail="Interview not found")


def _get_owned_follow_up(
    application_id: uuid.UUID,
    follow_up_id: uuid.UUID,
    current_user: User,
    db: Session,
) -> FollowUp:
    _get_owned_application(application_id, current_user, db)
    follow_up = db.scalar(
        select(FollowUp).where(
            FollowUp.id == follow_up_id,
            FollowUp.application_id == application_id,
            FollowUp.user_id == current_user.id,
        )
    )
    if follow_up is None:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return follow_up


@router.post(
    "/{application_id}/follow-ups",
    response_model=FollowUpOut,
    status_code=201,
)
def create_follow_up(
    application_id: uuid.UUID,
    payload: FollowUpCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowUp:
    _get_owned_application(application_id, current_user, db)
    if payload.interview_id is not None:
        _validate_owned_interview(
            application_id,
            payload.interview_id,
            current_user,
            db,
        )

    follow_up = FollowUp(
        user_id=current_user.id,
        application_id=application_id,
        **payload.model_dump(),
    )
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)
    return follow_up


@router.get(
    "/{application_id}/follow-ups",
    response_model=list[FollowUpOut],
)
def list_follow_ups(
    application_id: uuid.UUID,
    interview_id: uuid.UUID | None = Query(default=None),
    completed: bool | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FollowUp]:
    _get_owned_application(application_id, current_user, db)
    query = select(FollowUp).where(
        FollowUp.application_id == application_id,
        FollowUp.user_id == current_user.id,
    )
    if interview_id is not None:
        _validate_owned_interview(application_id, interview_id, current_user, db)
        query = query.where(FollowUp.interview_id == interview_id)
    if completed is True:
        query = query.where(FollowUp.completed_at.is_not(None))
    elif completed is False:
        query = query.where(FollowUp.completed_at.is_(None))
    return list(db.scalars(query.order_by(FollowUp.due_at_utc.asc(), FollowUp.created_at.asc())))


@router.get(
    "/{application_id}/follow-ups/{follow_up_id}",
    response_model=FollowUpOut,
)
def get_follow_up(
    application_id: uuid.UUID,
    follow_up_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowUp:
    return _get_owned_follow_up(application_id, follow_up_id, current_user, db)


@router.patch(
    "/{application_id}/follow-ups/{follow_up_id}",
    response_model=FollowUpOut,
)
def update_follow_up(
    application_id: uuid.UUID,
    follow_up_id: uuid.UUID,
    payload: FollowUpUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FollowUp:
    follow_up = _get_owned_follow_up(application_id, follow_up_id, current_user, db)
    update_data = payload.model_dump(exclude_unset=True)
    if "interview_id" in update_data and update_data["interview_id"] is not None:
        _validate_owned_interview(
            application_id,
            update_data["interview_id"],
            current_user,
            db,
        )
    for field, value in update_data.items():
        setattr(follow_up, field, value)
    db.commit()
    db.refresh(follow_up)
    return follow_up


@router.delete(
    "/{application_id}/follow-ups/{follow_up_id}",
    status_code=204,
)
def delete_follow_up(
    application_id: uuid.UUID,
    follow_up_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    follow_up = _get_owned_follow_up(application_id, follow_up_id, current_user, db)
    db.delete(follow_up)
    db.commit()
    return Response(status_code=204)
