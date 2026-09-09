from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Company
from app.schemas import CompanyCreate, CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])

ATS_SOURCE_TYPES = {"ashby", "greenhouse", "lever"}


@router.get("", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)) -> list[Company]:
    return list(db.scalars(select(Company).order_by(Company.name)))


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(payload: CompanyCreate, db: Session = Depends(get_db)) -> Company:
    board_token = payload.board_token.strip() if payload.board_token else None

    # ATS-backed sources need a provider-specific board token or company slug.
    if payload.source_type in ATS_SOURCE_TYPES and not board_token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"board_token is required for {payload.source_type} sources",
        )

    company = Company(
        name=payload.name.strip(),
        source_type=payload.source_type,
        board_token=board_token,
        careers_url=payload.careers_url.strip() if payload.careers_url else None,
        priority=payload.priority,
    )
    db.add(company)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "A company source with this provider and board token already exists."
            ),
        ) from exc

    db.refresh(company)
    return company
