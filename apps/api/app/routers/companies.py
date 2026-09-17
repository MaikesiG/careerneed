from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Company, User
from app.schemas import CompanyCreate, CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])

ATS_SOURCE_TYPES = {"ashby", "greenhouse", "lever"}


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Company]:
    return (
        db.query(Company)
        .filter(Company.user_id == current_user.id)
        .order_by(Company.created_at.desc())
        .all()
    )


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Company:
    board_token = payload.board_token.strip() if payload.board_token else None

    if payload.source_type in ATS_SOURCE_TYPES and not board_token:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"board_token is required for {payload.source_type} sources",
        )

    company = Company(
        user_id=current_user.id,
        name=payload.name.strip(),
        source_type=payload.source_type,
        board_token=board_token,
        careers_url=payload.careers_url.strip() if payload.careers_url else None,
        priority=payload.priority,
    )

    db.add(company)

    try:
        db.commit()
        db.refresh(company)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already added this company source",
        ) from exc

    return company


@router.post("/batch", response_model=list[CompanyOut], status_code=status.HTTP_201_CREATED)
def create_companies_batch(
    payload: list[CompanyCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Company]:
    added: list[Company] = []
    for item in payload:
        board_token = item.board_token.strip() if item.board_token else None
        if item.source_type in ATS_SOURCE_TYPES and not board_token:
            continue

        existing = (
            db.query(Company)
            .filter(
                Company.user_id == current_user.id,
                Company.source_type == item.source_type,
                Company.board_token == board_token,
            )
            .first()
        )
        if existing:
            continue

        company = Company(
            user_id=current_user.id,
            name=item.name.strip(),
            source_type=item.source_type,
            board_token=board_token,
            careers_url=item.careers_url.strip() if item.careers_url else None,
            priority=item.priority,
        )
        db.add(company)
        added.append(company)

    if added:
        db.commit()
        for company in added:
            db.refresh(company)

    return added
