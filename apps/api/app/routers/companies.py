import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.curated_targets import CURATED_TARGETS, normalize_curated_target_name
from app.database import get_db
from app.models import Company, User
from app.schemas import (
    CompanyCreate,
    CompanyOut,
    CuratedTargetsAddAllOut,
    CuratedTargetsPreviewOut,
)

router = APIRouter(prefix="/companies", tags=["companies"])

ATS_SOURCE_TYPES = {"ashby", "greenhouse", "lever"}


def _existing_curated_target_names(db: Session, user_id: uuid.UUID) -> set[str]:
    names = db.query(Company.name).filter(Company.user_id == user_id).all()
    return {normalize_curated_target_name(name) for (name,) in names}


@router.get("/curated-targets/preview", response_model=CuratedTargetsPreviewOut)
def preview_curated_targets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CuratedTargetsPreviewOut:
    existing_names = _existing_curated_target_names(db, current_user.id)
    already_present = sum(
        normalize_curated_target_name(target["name"]) in existing_names
        for target in CURATED_TARGETS
    )
    return CuratedTargetsPreviewOut(
        total_curated=len(CURATED_TARGETS),
        to_create=len(CURATED_TARGETS) - already_present,
        already_present=already_present,
    )


@router.post("/curated-targets/add-all", response_model=CuratedTargetsAddAllOut)
def add_all_curated_targets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CuratedTargetsAddAllOut:
    # Serialize this user's bulk operations so concurrent requests remain idempotent.
    db.query(User).filter(User.id == current_user.id).with_for_update().one()
    existing_names = _existing_curated_target_names(db, current_user.id)
    created = 0

    for target in CURATED_TARGETS:
        normalized_name = normalize_curated_target_name(target["name"])
        if normalized_name in existing_names:
            continue
        db.add(
            Company(
                user_id=current_user.id,
                name=target["name"],
                source_type="manual",
                board_token=None,
                careers_url=None,
                priority="medium",
            )
        )
        existing_names.add(normalized_name)
        created += 1

    if created:
        db.commit()

    total_curated = len(CURATED_TARGETS)
    return CuratedTargetsAddAllOut(
        created=created,
        already_present=total_curated - created,
        total_curated=total_curated,
    )


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
