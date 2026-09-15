import uuid

import pdfplumber
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Resume, User
from app.schemas import ResumeDetail, ResumeOut, ResumeUpdate
from app.services.skill_extractor import extract_skills

router = APIRouter(prefix="/resumes", tags=["resumes"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _extract_text(file_bytes: bytes) -> str:
    import io

    text_parts: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n".join(text_parts).strip()


@router.get("", response_model=list[ResumeOut])
def list_resumes(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Resume]:
    statement = (
        select(Resume)
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.uploaded_at.desc())
    )
    if not include_archived:
        statement = statement.where(Resume.archived_at.is_(None))
    return list(db.scalars(statement))


@router.get("/{resume_id}", response_model=ResumeDetail)
def get_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Resume:
    resume = db.scalar(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
    )
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


@router.post("/upload", response_model=ResumeOut, status_code=201)
async def upload_resume(
    file: UploadFile,
    label: str | None = None,
    is_default: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Resume:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=422, detail="Only PDF files are supported")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="File exceeds 10MB limit")

    raw_text = _extract_text(file_bytes)
    if not raw_text:
        raise HTTPException(status_code=422, detail="Could not extract any text from this PDF")

    if is_default:
        db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.archived_at.is_(None),
            Resume.is_default.is_(True),
        ).update(
            {"is_default": False},
            synchronize_session=False,
        )

    resume = Resume(
        user_id=current_user.id,
        filename=file.filename or "resume.pdf",
        raw_text=raw_text,
        skills=extract_skills(db, current_user.id, raw_text),
        label=label,
        is_default=is_default,
        source="upload",
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return resume


@router.patch("/{resume_id}", response_model=ResumeOut)
def update_resume(
    resume_id: uuid.UUID,
    payload: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Resume:
    resume = db.scalar(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
    )

    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    update_data = payload.model_dump(exclude_unset=True)
    effective_archived_at = update_data.get("archived_at", resume.archived_at)

    if update_data.get("is_default") is True and effective_archived_at is not None:
        raise HTTPException(
            status_code=409,
            detail="Archived resume cannot be set as default. Restore it first.",
        )

    if "archived_at" in update_data and update_data["archived_at"] is not None:
        update_data["is_default"] = False

    if update_data.get("is_default") is True:
        db.query(Resume).filter(
            Resume.user_id == current_user.id,
            Resume.id != resume_id,
            Resume.archived_at.is_(None),
            Resume.is_default.is_(True),
        ).update(
            {"is_default": False},
            synchronize_session=False,
        )

    for field, value in update_data.items():
        setattr(resume, field, value)

    db.commit()
    db.refresh(resume)
    return resume


@router.delete("/{resume_id}", status_code=204)
def delete_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    resume = db.scalar(
        select(Resume).where(
            Resume.id == resume_id,
            Resume.user_id == current_user.id,
        )
    )

    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    if resume.is_default and resume.archived_at is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete the default resume. "
                "Set another active resume as default first."
            ),
        )

    db.delete(resume)
    db.commit()
    return Response(status_code=204)
