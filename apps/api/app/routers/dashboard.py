from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Application
from app.routers.applications import INITIAL_USER_ID
from app.schemas import DashboardSummaryOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def count_applications(
    db: Session,
    *conditions: object,
) -> int:
    statement = select(func.count()).select_from(Application).where(
        Application.user_id == INITIAL_USER_ID,
        *conditions,
    )
    return db.scalar(statement) or 0


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummaryOut:
    today = date.today()

    applications_saved = count_applications(db, Application.status == "saved")
    applications_applied = count_applications(db, Application.status == "applied")
    applications_interviewing = count_applications(db, Application.status == "interviewing")

    return DashboardSummaryOut(
        follow_ups_due_today=count_applications(db, Application.follow_up_on == today),
        follow_ups_overdue=count_applications(
            db,
            Application.follow_up_on.is_not(None),
            Application.follow_up_on < today,
        ),
        applications_saved=applications_saved,
        applications_applied=applications_applied,
        applications_interviewing=applications_interviewing,
        active_applications=applications_applied + applications_interviewing,
    )
